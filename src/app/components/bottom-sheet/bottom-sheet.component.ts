import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

/** Coquille visuelle standard pour le contenu d'une feuille (bottom sheet)
 *  ouverte via BottomSheetService : poignée + en-tête optionnel (titre +
 *  bouton fermer) + zone de contenu (projection). Reprend le visuel de
 *  .modal-handle déjà utilisé en dur dans credits.page.html/scss.
 *
 *  Usage : le composant passé à `BottomSheetService.open(...)` place son
 *  contenu à l'intérieur de <gl-bottom-sheet>...</gl-bottom-sheet>. */
@Component({
  selector: 'gl-bottom-sheet',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './bottom-sheet.component.html',
  styleUrls: ['./bottom-sheet.component.scss']
})
export class BottomSheetComponent {
  @Input() title?: string;
  @Input() showClose = true;

  @Output() closeSheet = new EventEmitter<void>();
}
