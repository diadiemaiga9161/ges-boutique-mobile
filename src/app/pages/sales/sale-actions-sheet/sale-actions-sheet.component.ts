import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { BottomSheetComponent } from '../../../components/bottom-sheet/bottom-sheet.component';
import { VenteMap } from '../../../services/vente.service';

import { ActionPermission, RoleService } from '../../../services/role.service';
export type SaleActionKey = 'voir' | 'modifier' | 'annuler' | 'retour' | 'pdf' | 'qr';

/** Contenu du tiroir "···" ouvert depuis une carte de vente (sales.page.html)
 *  pour les actions secondaires qui ne tiennent plus dans la rangée compacte
 *  de la carte (Détails/Imprimer thermique/WhatsApp restent visibles sur la
 *  carte, le reste — Voir/Modifier/Annuler/Retour/PDF/QR — passe ici).
 *
 *  Purement présentationnel, comme gl-confirm-sheet : ne connaît aucune
 *  logique métier, se contente de renvoyer la clé de l'action choisie via
 *  ModalController.dismiss(). C'est sales.page.ts qui appelle ensuite la
 *  méthode existante correspondante (confirmModify, confirmCancel, etc.),
 *  aucune n'est dupliquée ni modifiée ici. */
@Component({
  selector: 'app-sale-actions-sheet',
  standalone: true,
  imports: [CommonModule, IonicModule, BottomSheetComponent],
  templateUrl: './sale-actions-sheet.component.html',
  styleUrls: ['./sale-actions-sheet.component.scss']
})
export class SaleActionsSheetComponent {
  @Input() sale!: VenteMap;

  constructor(
    private roleService: RoleService,
    private modalCtrl: ModalController) {}

  /** Bouton visible seulement si le rôle de la personne permet l'action (rôles personnalisés). */
  peut(module: string, action: ActionPermission): boolean {
    return this.roleService.peut(module, action);
  }


  choose(action: SaleActionKey): void {
    this.modalCtrl.dismiss(action);
  }

  close(): void {
    this.modalCtrl.dismiss();
  }
}
