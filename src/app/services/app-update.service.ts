import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController } from '@ionic/angular';
import { filter } from 'rxjs/operators';

/** Vérifie périodiquement si une nouvelle version de l'appli a été déployée sur le
 *  serveur, et propose à l'utilisateur de recharger — sans quoi le service worker
 *  continue de servir l'ancienne version en cache indéfiniment après un déploiement. */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly INTERVALLE_VERIFICATION_MS = 6 * 60 * 60 * 1000; // 6h

  constructor(private swUpdate: SwUpdate, private alertCtrl: AlertController) {}

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates.pipe(
      filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY')
    ).subscribe(() => this.proposerMiseAJour());

    setInterval(() => {
      this.swUpdate.checkForUpdate().catch(() => {});
    }, this.INTERVALLE_VERIFICATION_MS);
  }

  private async proposerMiseAJour(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Nouvelle version disponible',
      message: 'Une mise à jour de l\'application est prête. Recharger maintenant ?',
      buttons: [
        { text: 'Plus tard', role: 'cancel' },
        {
          text: 'Mettre à jour',
          cssClass: 'alert-btn-primary',
          handler: async () => {
            // Vide aussi le cache de données du service worker (dataGroups de
            // ngsw-config.json) — sinon la nouvelle version peut réafficher une
            // réponse API mise en cache par l'ANCIENNE version.
            await this.viderCacheDonnees();
            document.location.reload();
          },
        },
      ],
    });
    await alert.present();
  }

  private async viderCacheDonnees(): Promise<void> {
    try {
      const noms = await caches.keys();
      await Promise.all(noms.filter(n => n.includes('ngsw:')).map(n => caches.delete(n)));
    } catch { /* pas grave si ça échoue, le reload reste utile seul */ }
  }
}
