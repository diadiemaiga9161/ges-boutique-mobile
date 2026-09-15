import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

export type GlStockStatus = 'ok' | 'low' | 'out';

/** Pastille de statut stock — OK (vert) / Bas (orange) / Rupture (rouge).
 *  Centralise la logique de seuil déjà dupliquée dans plusieurs pages
 *  (cf. products.page.ts#getStockClass/getStockText et
 *  inventaire.service.ts#getStockStatusClass/getStockStatusText) :
 *  quantité <= 0 → Rupture, quantité <= seuil → Bas, sinon → OK.
 *
 *  Affichage : « <quantité> <nom du niveau> · <statut> ». Le nom du niveau est
 *  celui défini par le produit (Produit.uniteBase, ex. « Bouteille », « Sac ») ;
 *  repli sur le libellé traduit neutre (PRODUCTS.TYPE_UNITE) uniquement si le
 *  produit n'en a pas. */
@Component({
  selector: 'gl-stock-badge',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './stock-badge.component.html',
  styleUrls: ['./stock-badge.component.scss']
})
export class StockBadgeComponent {
  @Input() stock = 0;
  @Input() seuil = 0;
  /** Nom réel du niveau/unité du produit (Produit.uniteBase). Optionnel. */
  @Input() unite?: string | null;

  get status(): GlStockStatus {
    if (this.stock <= 0) return 'out';
    if (this.stock <= this.seuil) return 'low';
    return 'ok';
  }

  /** Clé i18n du statut (affichage uniquement). */
  get statusKey(): string {
    return this.status === 'out'
      ? 'PRODUCTS.STOCK_OUT_SHORT'
      : this.status === 'low' ? 'PRODUCTS.STOCK_LOW_SHORT' : 'PRODUCTS.STOCK_OK';
  }

  /** Nom du niveau défini par le produit, ou null s'il n'y en a pas. */
  get uniteNom(): string | null {
    const nom = (this.unite ?? '').trim();
    return nom.length ? nom : null;
  }
}
