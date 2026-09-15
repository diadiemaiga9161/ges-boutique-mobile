import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

export type GlQuickActionVariant = 'blue' | 'green' | 'orange' | 'red' | 'slate';

/** Bouton rond icône + label, pour rangées d'actions rapides (ex: futur
 *  "Vendre / Encaisser / Appeler" sur une fiche client). Aucun équivalent
 *  visuel exact n'existe déjà dans le projet (le plus proche,
 *  .client-action-btn dans clients.page.scss, est une colonne plate dans
 *  un pied de carte, pas un bouton rond) — design neuf cohérent avec la
 *  palette --gl-*. */
@Component({
  selector: 'gl-quick-action',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './quick-action.component.html',
  styleUrls: ['./quick-action.component.scss']
})
export class QuickActionComponent {
  @Input() icon = '';
  @Input() label = '';
  @Input() variant: GlQuickActionVariant = 'blue';

  @Output() actionClick = new EventEmitter<void>();
}
