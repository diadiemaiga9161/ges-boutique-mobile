import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FactureDesignService, DesignFacture, DESIGNS, DesignInfo } from '../../services/facture-design.service';

@Component({
  selector: 'app-facture-design',
  templateUrl: './facture-design.page.html',
  styleUrls: ['./facture-design.page.scss'],
  standalone: false
})
export class FactureDesignPage {

  designs: DesignInfo[] = DESIGNS;
  selected: DesignFacture;

  constructor(
    private designService: FactureDesignService,
    private toastCtrl: ToastController
  ) {
    this.selected = this.designService.getDesign();
  }

  choisir(id: DesignFacture): void {
    this.selected = id;
    this.designService.setDesign(id);
    this.toast('Design sauvegardé ✓');
  }

  private async toast(msg: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 1800, position: 'bottom', color: 'success' });
    await t.present();
  }
}
