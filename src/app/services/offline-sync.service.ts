import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
    private http: HttpClient
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

    const pendingActions = this.queueService.getPendingActions();
    let successCount = 0;
    let failureCount = 0;

    for (const action of pendingActions) {
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

        if (action.attemptCount >= 3) {
          console.warn(`Action ${action.id} échouée après 3 tentatives:`, errorMsg);
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
