import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { BoutiqueConfigService } from '../../services/boutique-config.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-boutique-select',
  templateUrl: './boutique-select.page.html',
  styleUrls: ['./boutique-select.page.scss'],
  standalone: false,
})
export class BoutiqueSelectPage {
  boutiques = environment.boutiques;
  isLoading = false;

  constructor(
    private boutiqueConfig: BoutiqueConfigService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async selectBoutique(boutique: { nom: string; url: string }): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: 'Connexion...', spinner: 'crescent' });
    await loading.present();
    this.isLoading = true;

    try {
      const response = await fetch(`${boutique.url}/api/auth/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      }).catch(() => null);

      await this.boutiqueConfig.setBoutique(boutique.nom, boutique.url);
      await loading.dismiss();
      this.isLoading = false;
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch {
      await loading.dismiss();
      this.isLoading = false;
      await this.boutiqueConfig.setBoutique(boutique.nom, boutique.url);
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
}
