import { Injectable } from '@angular/core';
import { Produit } from './product.service';

@Injectable({ providedIn: 'root' })
export class StockAlertService {

  private lastAlertedIds = new Set<number>();

  async requestPermission(): Promise<void> {
    // Notifications systeme desactivees — affichage uniquement dans la page Notifications
  }

  async verifierStock(produits: Produit[]): Promise<void> {
    const faibles = produits.filter(p => p.quantite <= (p.seuilAlerte || 5) && p.quantite > 0);
    const rupture = produits.filter(p => p.quantite === 0);
    [...faibles, ...rupture].forEach(p => this.lastAlertedIds.add(p.id));
    // Toasts et notifications systeme supprimes — voir page Notifications
  }

  resetAlertes(): void {
    this.lastAlertedIds.clear();
  }
}
