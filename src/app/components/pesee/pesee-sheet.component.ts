import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { InfoMesure, infoMesure, lireNombre } from '../../utils/mesure.util';

export interface ProduitPesee {
  nom: string;
  modeMesure?: string | null;
  /** Prix stocké, par petite unité (F/g). */
  prixVente: number;
  /** Stock stocké, en petite unité (g). */
  quantite: number;
}

/**
 * Pesée (vente à la mesure) — même logique que la fenêtre du site web : poids tapé ou
 * bouton rapide, ou montant demandé par le client ("pour 500 F"). À placer dans un
 * <ion-modal> ; renvoie la quantité en petite unité (g, ml, cm).
 */
@Component({
  selector: 'gl-pesee-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './pesee-sheet.component.html',
  styleUrls: ['./pesee-sheet.component.scss'],
  // Dans un <ion-modal>, le composant doit se comporter comme une page Ionic pleine
  // hauteur, sinon <ion-content> s'écrase et seule une bande reste visible.
  host: { class: 'ion-page' }
})
export class PeseeSheetComponent implements OnInit {
  @Input() produit!: ProduitPesee;
  @Input() quantiteInitiale: number | null = null;
  @Input() maximum: number | null = null;
  @Output() valider = new EventEmitter<{ quantite: number; montant: number | null }>();
  @Output() annuler = new EventEmitter<void>();

  info!: InfoMesure;
  mode: 'poids' | 'montant' = 'poids';
  saisiePoids = '';
  saisieMontant = '';
  erreur = '';

  ngOnInit(): void {
    this.info = infoMesure(this.produit) || { facteur: 1, unite: '', petiteUnite: '', libelle: '', rapides: [1] };
    if (this.quantiteInitiale) {
      this.saisiePoids = this.formater(this.quantiteInitiale / this.info.facteur);
    }
  }

  get prixParUnite(): number {
    return (this.produit?.prixVente || 0) * this.info.facteur;
  }

  get stockMax(): number {
    return this.maximum ?? this.produit?.quantite ?? 0;
  }

  get stockAffiche(): string {
    return this.formater(this.stockMax / this.info.facteur) + ' ' + this.info.unite;
  }

  get quantite(): number {
    if (this.mode === 'poids') {
      return Math.round(lireNombre(this.saisiePoids) * this.info.facteur);
    }
    const prix = this.produit?.prixVente || 0;
    return prix > 0 ? Math.round(lireNombre(this.saisieMontant) / prix) : 0;
  }

  get montant(): number {
    if (this.mode === 'montant' && this.quantite > 0) return lireNombre(this.saisieMontant);
    return this.quantite * (this.produit?.prixVente || 0);
  }

  get poidsTexte(): string {
    return this.formater(this.quantite / this.info.facteur) + ' ' + this.info.unite;
  }

  rapide(v: number): void {
    this.mode = 'poids';
    this.saisiePoids = this.formater(v);
    this.erreur = '';
  }

  confirmer(): void {
    const q = this.quantite;
    if (q <= 0) {
      this.erreur = this.mode === 'poids' ? `Indiquez la quantité en ${this.info.unite}.` : 'Indiquez le montant demandé.';
      return;
    }
    if (q > this.stockMax) {
      this.erreur = `Stock insuffisant : il reste ${this.stockAffiche}.`;
      return;
    }
    this.valider.emit({ quantite: q, montant: this.mode === 'montant' ? lireNombre(this.saisieMontant) : null });
  }

  formater(v: number): string {
    return (Math.round(v * 1000) / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
  }

  fmtPrix(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v || 0)) + ' F';
  }
}
