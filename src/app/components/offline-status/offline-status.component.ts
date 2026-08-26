import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { NetworkStatusService, NetworkStatus } from '../../services/network-status.service';

/** Point de statut réseau — vert (connecté) / orange (hors ligne), fixe en
 *  haut de l'écran, sur toutes les pages (monté une seule fois à la racine
 *  de app.component.html, hors de ion-router-outlet). Remplace l'ancienne
 *  grande carte avec détails de synchronisation + bouton réessayer : plus
 *  de gros bandeau, juste le signe. */
@Component({
  selector: 'app-offline-status',
  templateUrl: './offline-status.component.html',
  styleUrls: ['./offline-status.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class OfflineStatusComponent {
  networkStatus$: Observable<NetworkStatus>;

  constructor(private networkService: NetworkStatusService) {
    this.networkStatus$ = this.networkService.getNetworkStatus();
  }
}
