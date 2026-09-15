import { Injectable, Type } from '@angular/core';
import { ModalController } from '@ionic/angular';

/** Standardise l'usage de ion-modal en mode "feuille" (breakpoints) déjà
 *  présent en dur dans plusieurs pages (ex: clients.page.html — modale QR
 *  `[breakpoints]="[0, 0.55]" [initialBreakpoint]="0.55"`, credits.page.html
 *  — modale détail vente `[0, 0.92]`). Ce service ouvre dynamiquement un
 *  composant via ModalController.create avec des valeurs par défaut
 *  cohérentes (poignée visible via <gl-bottom-sheet>, coins arrondis en
 *  haut, safe-area respectée). */
@Injectable({ providedIn: 'root' })
export class BottomSheetService {

  constructor(private modalCtrl: ModalController) {}

  /** Ouvre `component` dans une feuille glissante depuis le bas et résout
   *  avec la donnée passée à `modal.dismiss(data)` (ou `undefined` si
   *  l'utilisateur ferme sans rien renvoyer). */
  async open<T = any>(
    component: Type<unknown>,
    componentProps?: Record<string, unknown>,
    breakpoints: number[] = [0, 0.9]
  ): Promise<T | undefined> {
    const initialBreakpoint = breakpoints[breakpoints.length - 1];

    const modal = await this.modalCtrl.create({
      component,
      componentProps,
      breakpoints,
      initialBreakpoint,
      handle: false, // poignée gérée par <gl-bottom-sheet> pour un rendu cohérent
      showBackdrop: true,
      cssClass: 'gl-bottom-sheet-modal'
    });

    await modal.present();
    const { data } = await modal.onDidDismiss<T>();
    return data;
  }

  /** Ferme la feuille actuellement affichée (à appeler depuis le composant
   *  ouvert par `open()`, typiquement sur le bouton fermer/valider). */
  async dismiss(data?: unknown): Promise<void> {
    await this.modalCtrl.dismiss(data);
  }
}
