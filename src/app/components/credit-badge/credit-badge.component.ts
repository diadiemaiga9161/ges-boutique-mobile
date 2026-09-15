import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type GlCreditStatut = 'a-jour' | 'en-retard' | 'solde';

/** Pastille de statut crédit. Prend en entrée les 2 booléens déjà calculés
 *  côté page (cf. credits.page.ts : `estReglee` et `enRetard`, dérivés de
 *  montantRestant/dateEcheance avec la date du jour) plutôt que de
 *  redériver cette logique de date ici — ce composant reste purement
 *  présentationnel et n'a pas à dupliquer un calcul métier (fuseau horaire,
 *  arrondis de montant...). */
@Component({
  selector: 'gl-credit-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credit-badge.component.html',
  styleUrls: ['./credit-badge.component.scss']
})
export class CreditBadgeComponent {
  @Input() estReglee = false;
  @Input() enRetard = false;

  get statut(): GlCreditStatut {
    if (this.estReglee) return 'solde';
    if (this.enRetard) return 'en-retard';
    return 'a-jour';
  }

  get label(): string {
    if (this.statut === 'solde') return 'Réglé';
    if (this.statut === 'en-retard') return 'En retard';
    return 'En cours';
  }
}
