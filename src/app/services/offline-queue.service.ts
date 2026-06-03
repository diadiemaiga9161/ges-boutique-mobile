import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject, Observable } from 'rxjs';

export interface OfflineAction {
  id: string;
  type: 'VENTE' | 'VENTE_CREDIT' | 'REGLEMENT_CREDIT' | 'MODIFICATION_VENTE';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data: any;
  clientRequestId: string;
  status: 'EN_ATTENTE' | 'EN_COURS' | 'SUCCES' | 'ECHEC';
  createdAt: string;
  attemptCount: number;
  lastError?: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineQueueService {
  private readonly QUEUE_KEY = 'offline_queue';
  private queue$ = new BehaviorSubject<OfflineAction[]>([]);

  constructor(private storage: Storage) {
    this.loadQueue();
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await this.storage.get(this.QUEUE_KEY);
      this.queue$.next(stored ? JSON.parse(stored) : []);
    } catch (error) {
      console.error('Erreur lors du chargement de la queue offline:', error);
      this.queue$.next([]);
    }
  }

  async addAction(action: Omit<OfflineAction, 'id' | 'status' | 'createdAt' | 'attemptCount'>): Promise<OfflineAction> {
    const newAction: OfflineAction = {
      ...action,
      id: this.generateId(),
      status: 'EN_ATTENTE',
      createdAt: new Date().toISOString(),
      attemptCount: 0
    };

    const currentQueue = this.queue$.value;
    const updatedQueue = [...currentQueue, newAction];
    this.queue$.next(updatedQueue);
    await this.persistQueue(updatedQueue);
    return newAction;
  }

  getQueueObservable(): Observable<OfflineAction[]> {
    return this.queue$.asObservable();
  }

  getQueue(): OfflineAction[] {
    return this.queue$.value;
  }

  getPendingActions(): OfflineAction[] {
    return this.queue$.value.filter(a => a.status === 'EN_ATTENTE');
  }

  getActionsByType(type: OfflineAction['type']): OfflineAction[] {
    return this.queue$.value.filter(a => a.type === type);
  }

  async updateActionStatus(
    actionId: string,
    status: OfflineAction['status'],
    error?: string
  ): Promise<void> {
    const currentQueue = this.queue$.value;
    const updatedQueue = currentQueue.map(action =>
      action.id === actionId
        ? {
            ...action,
            status,
            lastError: error,
            attemptCount: status === 'EN_COURS' ? action.attemptCount + 1 : action.attemptCount
          }
        : action
    );
    this.queue$.next(updatedQueue);
    await this.persistQueue(updatedQueue);
  }

  async removeAction(actionId: string): Promise<void> {
    const currentQueue = this.queue$.value;
    const updatedQueue = currentQueue.filter(a => a.id !== actionId);
    this.queue$.next(updatedQueue);
    await this.persistQueue(updatedQueue);
  }

  async clearSuccessfulActions(): Promise<void> {
    const currentQueue = this.queue$.value;
    const updatedQueue = currentQueue.filter(a => a.status !== 'SUCCES');
    this.queue$.next(updatedQueue);
    await this.persistQueue(updatedQueue);
  }

  async clearAll(): Promise<void> {
    this.queue$.next([]);
    await this.storage.remove(this.QUEUE_KEY);
  }

  private async persistQueue(queue: OfflineAction[]): Promise<void> {
    try {
      await this.storage.set(this.QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la queue offline:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

