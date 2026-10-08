import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { BoutiqueConfigService } from '../../services/boutique-config.service';
import { BoutiqueService } from '../../services/boutique.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-boutique-select',
  templateUrl: './boutique-select.page.html',
  styleUrls: ['./boutique-select.page.scss'],
  standalone: false,
})
export class BoutiqueSelectPage {
  // Priorité à la liste "Boutiques partenaires" de la boutique qu'on vient de quitter
  // (gérée par l'utilisateur lui-même, voir changerBoutique() dans profile.page.ts) —
  // la liste figée du code ne sert plus que de secours au tout premier lancement, quand
  // aucune boutique n'a encore été configurée et qu'il n'y a donc aucun partenaire à lire.
  boutiques = this.boutiqueConfig.getPartenairesCache() || environment.boutiques;
  isLoading = false;

  constructor(
    private boutiqueConfig: BoutiqueConfigService,
    private boutiqueService: BoutiqueService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {}

  async selectBoutique(choix: { nom: string; url: string }): Promise<void> {
    // Seulement une adresse http(s) : jamais "javascript:..." ou autre (sécurité).
    const url = BoutiqueConfigService.adresseSure(choix.url);
    if (!url) {
      const t = await this.toastCtrl.create({ message: 'Adresse de boutique invalide', color: 'danger', duration: 2500 });
      await t.present();
      return;
    }
    const boutique = { nom: choix.nom, url };

    // Web/PWA : chaque boutique est un site séparé (origine différente) — on ne
    // peut pas juste "repointer" l'API comme sur natif, il faut une vraie
    // navigation de page vers le /mobile/ de l'autre boutique (sinon les appels
    // API suivants seraient bloqués par le CORS du serveur de destination).
    if (!environment.isCapacitor) {
      window.location.href = `${boutique.url}/mobile/`;
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Connexion...', spinner: 'crescent' });
    await loading.present();
    this.isLoading = true;

    try {
      const response = await fetch(`${boutique.url}/api/auth/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      }).catch(() => null);

      await this.boutiqueConfig.setBoutique(boutique.nom, boutique.url);
      this.boutiqueService.oublierDerniereReponse();
      await loading.dismiss();
      this.isLoading = false;
      this.router.navigateByUrl('/login', { replaceUrl: true });
    } catch {
      await loading.dismiss();
      this.isLoading = false;
      await this.boutiqueConfig.setBoutique(boutique.nom, boutique.url);
      this.boutiqueService.oublierDerniereReponse();
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }
}
