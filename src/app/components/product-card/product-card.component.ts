import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { StockBadgeComponent } from '../stock-badge/stock-badge.component';

/** Carte produit compacte — reprend le visuel de .product-card
 *  (products.page.html/scss) pour consolider le markup dupliqué. Le
 *  formatage monétaire (prixVente/prixAchat) reste à la charge de l'appelant
 *  (productsService.formatPrice) : ce composant est purement présentationnel
 *  et ne doit pas dupliquer de logique métier. */
@Component({
  selector: 'gl-product-card',
  standalone: true,
  imports: [CommonModule, IonicModule, StockBadgeComponent],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss']
})
export class ProductCardComponent {
  @Input() nom = '';
  @Input() prixVente = '';
  @Input() prixAchat?: string;
  @Input() stock = 0;
  @Input() seuil = 0;
  /** Nom réel du niveau/unité du produit (Produit.uniteBase), transmis à la pastille de stock. */
  @Input() unite?: string | null;
  @Input() categorie?: string;
  @Input() badgeBio = false;

  @Output() cardClick = new EventEmitter<void>();
  @Output() editClick = new EventEmitter<void>();
  @Output() deleteClick = new EventEmitter<void>();

  onEdit(event: Event): void {
    event.stopPropagation();
    this.editClick.emit();
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.deleteClick.emit();
  }
}
