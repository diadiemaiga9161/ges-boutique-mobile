import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { NetworkStatusService, NetworkStatus } from '../../services/network-status.service';
import { OfflineSyncService, SyncStatus } from '../../services/offline-sync.service';
import { OfflineQueueService, OfflineAction } from '../../services/offline-queue.service';

@Component({
  selector: 'app-offline-status',
  templateUrl: './offline-status.component.html',
  styleUrls: ['./offline-status.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class OfflineStatusComponent implements OnInit {
  networkStatus$: Observable<NetworkStatus>;
  syncStatus$: Observable<SyncStatus>;
  offlineQueue$: Observable<OfflineAction[]>;
  showDetails = false;

  constructor(
    private networkService: NetworkStatusService,
    private offlineSyncService: OfflineSyncService,
    private queueService: OfflineQueueService
  ) {
    this.networkStatus$ = this.networkService.getNetworkStatus();
    this.syncStatus$ = this.offlineSyncService.getSyncStatus();
    this.offlineQueue$ = this.queueService.getQueueObservable();
  }

  ngOnInit(): void {}

  getStatusColor(status: string): string {
    switch (status) {
      case 'EN_ATTENTE': return 'warning';
      case 'EN_COURS': return 'primary';
      case 'SUCCES': return 'success';
      case 'ECHEC': return 'danger';
      default: return 'medium';
    }
  }

  countPending(queue: OfflineAction[] | null): number {
    if (!queue) return 0;
    return queue.filter(a => a.status === 'EN_ATTENTE').length;
  }

  hasPending(queue: OfflineAction[] | null): boolean {
    if (!queue) return false;
    return queue.some(a => a.status === 'EN_ATTENTE');
  }

  async forceSync(): Promise<void> {
    await this.offlineSyncService.syncPendingActions();
  }

  toggleDetails(): void {
    this.showDetails = !this.showDetails;
  }
}

