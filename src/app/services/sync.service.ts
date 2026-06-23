import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { ToastController } from '@ionic/angular';
import { VenteService } from './vente.service';
import { ProductService } from './product.service';
import { OfflineDbService } from './offline-db.service';

@Injectable({ providedIn: 'root' })
export class SyncService {
  private syncInProgress = false;

  constructor(
    private offlineDb: OfflineDbService,
    private venteService: VenteService,
    private productService: ProductService,
    private toastCtrl: ToastController,
  ) {}

  async isConnected(): Promise<boolean> {
    const status = await Network.getStatus();
    return status.connected ?? true;
  }

  async syncAll(): Promise<number> {
    if (this.syncInProgress) return 0;
    if (!(await this.isConnected())) return 0;
    this.syncInProgress = true;
    let synced = 0;

    try {
      // Ventes en attente
      const ventes = await this.offlineDb.getVentesPending();
      for (const v of ventes) {
        try {
          const { _localId, ...data } = v;
          await this.venteService.createVente(data).toPromise();
          await this.offlineDb.removeVentePending(_localId);
          synced++;
        } catch { }
      }

      // Nouveaux produits
      const produits = await this.offlineDb.getProduitsPending();
      for (const p of produits) {
        try {
          const { _localId, ...data } = p;
          await this.productService.createProduct(data).toPromise();
          await this.offlineDb.removeProduitPending(_localId);
          synced++;
        } catch { }
      }

      // Modifications produits
      const updates = await this.offlineDb.getProduitsUpdatesPending();
      for (const p of updates) {
        try {
          const { _localId, _produitId, ...data } = p;
          await this.productService.updateProduct(_produitId, data).toPromise();
          await this.offlineDb.removeProduitUpdatePending(_localId);
          synced++;
        } catch { }
      }
    } finally {
      this.syncInProgress = false;
    }

    return synced;
  }

  startAutoSync(): void {
    Network.addListener('networkStatusChange', async (status) => {
      if (status.connected) {
        const n = await this.syncAll();
        if (n > 0) {
          const toast = await this.toastCtrl.create({
            message: `✓ ${n} opération(s) synchronisée(s)`,
            color: 'success',
            duration: 3000,
            position: 'top',
          });
          toast.present();
        }
      }
    });
  }
}
