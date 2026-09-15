import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { BottomSheetComponent } from '../bottom-sheet/bottom-sheet.component';
import { BottomSheetService } from '../../services/bottom-sheet.service';

/** Contenu de la feuille de confirmation ouverte par ConfirmSheetService.
 *  Alternative tactile à AlertController.create pour les actions sensibles
 *  (suppression, etc.) : icône pastille colorée + titre + message + boutons
 *  Confirmer/Annuler. Purement présentationnel — se contente de renvoyer
 *  true/false au service appelant via BottomSheetService.dismiss(). */
@Component({
  selector: 'gl-confirm-sheet',
  standalone: true,
  imports: [CommonModule, IonicModule, BottomSheetComponent],
  templateUrl: './confirm-sheet.component.html',
  styleUrls: ['./confirm-sheet.component.scss']
})
export class ConfirmSheetComponent {
  @Input() icon = 'help-circle-outline';
  @Input() title = '';
  @Input() message = '';
  @Input() confirmLabel = 'Confirmer';
  @Input() cancelLabel = 'Annuler';
  @Input() danger = false;

  constructor(private sheet: BottomSheetService) {}

  onConfirm(): void {
    this.sheet.dismiss(true);
  }

  onCancel(): void {
    this.sheet.dismiss(false);
  }
}
