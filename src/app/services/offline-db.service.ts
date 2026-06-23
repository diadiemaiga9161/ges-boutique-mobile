import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

const KEY_VENTES    = 'offline_ventes_pending';
const KEY_PRODUITS  = 'offline_produits_pending';
const KEY_PROD_UPD  = 'offline_produits_updates';
const KEY_PROD_CACHE = 'offline_produits_cache';
const KEY_CLI_CACHE  = 'offline_clients_cache';

@Injectable({ providedIn: 'root' })
export class OfflineDbService {
  private initialized = false;

  constructor(private storage: Storage) {}

  async init(): Promise<void> {
    if (!this.initialized) {
      await this.storage.create();
      this.initialized = true;
    }
  }

  private localId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ─── Ventes ──────────────────────────────────────────────────────────────

  async saveVentePending(vente: any): Promise<string> {
    await this.init();
    const list: any[] = (await this.storage.get(KEY_VENTES)) || [];
    const id = this.localId();
    list.push({ _localId: id, ...vente });
    await this.storage.set(KEY_VENTES, list);
    return id;
  }

  async getVentesPending(): Promise<any[]> {
    await this.init();
    return (await this.storage.get(KEY_VENTES)) || [];
  }

  async removeVentePending(localId: string): Promise<void> {
    await this.init();
    const list = await this.getVentesPending();
    await this.storage.set(KEY_VENTES, list.filter(v => v._localId !== localId));
  }

  async countVentesPending(): Promise<number> {
    return (await this.getVentesPending()).length;
  }

  // ─── Produits créations ───────────────────────────────────────────────────

  async saveProduitPending(produit: any): Promise<string> {
    await this.init();
    const list: any[] = (await this.storage.get(KEY_PRODUITS)) || [];
    const id = this.localId();
    list.push({ _localId: id, ...produit });
    await this.storage.set(KEY_PRODUITS, list);
    return id;
  }

  async getProduitsPending(): Promise<any[]> {
    await this.init();
    return (await this.storage.get(KEY_PRODUITS)) || [];
  }

  async removeProduitPending(localId: string): Promise<void> {
    await this.init();
    const list = await this.getProduitsPending();
    await this.storage.set(KEY_PRODUITS, list.filter(p => p._localId !== localId));
  }

  // ─── Produits modifications ───────────────────────────────────────────────

  async saveProduitUpdatePending(produitId: number, data: any): Promise<void> {
    await this.init();
    const list: any[] = (await this.storage.get(KEY_PROD_UPD)) || [];
    list.push({ _localId: this.localId(), _produitId: produitId, ...data });
    await this.storage.set(KEY_PROD_UPD, list);
  }

  async getProduitsUpdatesPending(): Promise<any[]> {
    await this.init();
    return (await this.storage.get(KEY_PROD_UPD)) || [];
  }

  async removeProduitUpdatePending(localId: string): Promise<void> {
    await this.init();
    const list = await this.getProduitsUpdatesPending();
    await this.storage.set(KEY_PROD_UPD, list.filter(p => p._localId !== localId));
  }

  async countProduitsPending(): Promise<number> {
    const c = await this.getProduitsPending();
    const u = await this.getProduitsUpdatesPending();
    return c.length + u.length;
  }

  // ─── Cache produits ───────────────────────────────────────────────────────

  async cacheProduits(produits: any[]): Promise<void> {
    await this.init();
    await this.storage.set(KEY_PROD_CACHE, produits);
  }

  async getProduitsCache(): Promise<any[]> {
    await this.init();
    return (await this.storage.get(KEY_PROD_CACHE)) || [];
  }

  // ─── Cache clients ────────────────────────────────────────────────────────

  async cacheClients(clients: any[]): Promise<void> {
    await this.init();
    await this.storage.set(KEY_CLI_CACHE, clients);
  }

  async getClientsCache(): Promise<any[]> {
    await this.init();
    return (await this.storage.get(KEY_CLI_CACHE)) || [];
  }
}
