import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { switchMap, take, filter, delay } from 'rxjs/operators';
import { OfflineQueueService, OfflineAction } from './offline-queue.service';
import { NetworkStatusService } from './network-status.service';
import { v4 as uuidv4 } from 'uuid';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime?: string;
  syncedCount: number;
  failedCount: number;
}

/** Nombre maximum de tentatives de rejeu automatique pour une action en ECHEC
 *  avant de la considérer comme abandonnée et de réclamer une action de l'utilisateur. */
export const MAX_SYNC_ATTEMPTS = 5;

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private syncStatus$ = new BehaviorSubject<SyncStatus>({
    isSyncing: false,
    syncedCount: 0,
    failedCount: 0
  });

  private syncCompleted$ = new Subject<{ successful: number; failed: number }>();
  private isSyncing = false;

  constructor(
    private queueService: OfflineQueueService,
    private networkService: NetworkStatusService,
    private http: HttpClient,
    private toastController: ToastController
  ) {
    this.startNetworkMonitoring();
  }

  private startNetworkMonitoring(): void {
    this.networkService.getNetworkStatus()
      .pipe(
        filter(status => status.isOnline),
        delay(1000)
      )
      .subscribe(() => {
        this.syncPendingActions();
      });
  }

  async syncPendingActions(): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;
    this.updateSyncStatus({ isSyncing: true });

    // Rejoue les actions EN_ATTENTE ET les actions ECHEC pas encore abandonnées :
    // une opération en échec n'est jamais une impasse silencieuse, elle est retentée
    // automatiquement au prochain cycle de synchronisation (retour réseau ou forceSync()).
    const actionsToSync = this.queueService.getSyncableActions(MAX_SYNC_ATTEMPTS);
    let successCount = 0;
    let failureCount = 0;
    let abandonedCount = 0;

    for (const action of actionsToSync) {
      try {
        await this.queueService.updateActionStatus(action.id, 'EN_COURS');
        const result = await this.executeAction(action).toPromise();

        if (result) {
          await this.queueService.updateActionStatus(action.id, 'SUCCES');
          successCount++;
        }
      } catch (error: any) {
        failureCount++;
        const errorMsg = error?.error?.message || error?.message || 'Erreur inconnue';
        await this.queueService.updateActionStatus(action.id, 'ECHEC', errorMsg);

        const updatedAction = this.queueService.getQueue().find(a => a.id === action.id);
        const attempts = updatedAction?.attemptCount ?? action.attemptCount + 1;

        if (attempts >= MAX_SYNC_ATTEMPTS) {
          abandonedCount++;
          console.error(
            `Action ${action.id} (${action.type}) abandonnée après ${attempts} tentatives:`,
            errorMsg
          );
        } else {
          console.warn(
            `Action ${action.id} (${action.type}) en échec (tentative ${attempts}/${MAX_SYNC_ATTEMPTS}), nouvelle tentative automatique au prochain retour réseau:`,
            errorMsg
          );
        }
      }
    }

    await this.queueService.clearSuccessfulActions();

    this.isSyncing = false;
    this.updateSyncStatus({
      isSyncing: false,
      lastSyncTime: new Date().toISOString(),
      syncedCount: successCount,
      failedCount: failureCount
    });

    this.syncCompleted$.next({ successful: successCount, failed: failureCount });

    if (failureCount > 0) {
      await this.notifySyncFailures(failureCount, abandonedCount);
    }
  }

  /**
   * Alerte visible pour l'utilisateur : jamais d'échec silencieux.
   * Toast Ionic distinct selon que les échecs seront retentés automatiquement
   * ou qu'ils ont atteint la limite de tentatives (nécessitent une action manuelle).
   */
  private async notifySyncFailures(failureCount: number, abandonedCount: number): Promise<void> {
    const message = abandonedCount > 0
      ? `${abandonedCount} opération(s) hors ligne ont échoué après ${MAX_SYNC_ATTEMPTS} tentatives. Consultez le statut de synchronisation pour agir.`
      : `${failureCount} opération(s) hors ligne ont échoué. Nouvelle tentative automatique au prochain retour réseau.`;

    const toast = await this.toastController.create({
      message,
      duration: abandonedCount > 0 ? 7000 : 4000,
      color: 'danger',
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }

  private executeAction(action: OfflineAction): Observable<any> {
    const headers = { 'X-Client-Request-ID': action.clientRequestId };

    switch (action.method) {
      case 'POST':
        return this.http.post(action.endpoint, action.data, { headers });
      case 'PUT':
        return this.http.put(action.endpoint, action.data, { headers });
      case 'DELETE':
        return this.http.delete(action.endpoint, { headers });
      default:
        throw new Error(`Méthode HTTP non supportée: ${action.method}`);
    }
  }

  async addOfflineAction(
    type: OfflineAction['type'],
    endpoint: string,
    method: 'POST' | 'PUT' | 'DELETE',
    data: any
  ): Promise<OfflineAction> {
    const clientRequestId = uuidv4();
    return this.queueService.addAction({
      type,
      endpoint,
      method,
      data,
      clientRequestId
    });
  }

  generateClientRequestId(): string {
    return uuidv4();
  }

  getSyncStatus(): Observable<SyncStatus> {
    return this.syncStatus$.asObservable();
  }

  getSyncCompleted(): Observable<{ successful: number; failed: number }> {
    return this.syncCompleted$.asObservable();
  }

  getQueueObservable(): Observable<OfflineAction[]> {
    return this.queueService.getQueueObservable();
  }

  getPendingActions(): OfflineAction[] {
    return this.queueService.getPendingActions();
  }

  isOnline(): boolean {
    return this.networkService.isOnline();
  }

  private updateSyncStatus(update: Partial<SyncStatus>): void {
    const current = this.syncStatus$.value;
    this.syncStatus$.next({ ...current, ...update });
  }
}
