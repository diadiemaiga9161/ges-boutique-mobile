import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { Produit } from './product.service';

@Injectable({ providedIn: 'root' })
export class StockAlertService {

  private notifId = 1000;
  private permissionGranted = false;
  private lastAlertedIds = new Set<number>();

  constructor(private toastCtrl: ToastController) {}

  async requestPermission(): Promise<void> {
    if (!environment.isCapacitor) return;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const { display } = await LocalNotifications.requestPermissions();
      this.permissionGranted = display === 'granted';
    } catch { this.permissionGranted = false; }
  }

  async verifierStock(produits: Produit[]): Promise<void> {
    const faibles = produits.filter(p => p.quantite <= (p.seuilAlerte || 5) && p.quantite > 0);
    const rupture = produits.filter(p => p.quantite === 0);
    const nouveauxFaibles = faibles.filter(p => !this.lastAlertedIds.has(p.id));
    const nouvellesRuptures = rupture.filter(p => !this.lastAlertedIds.has(p.id));

    if (nouveauxFaibles.length === 0 && nouvellesRuptures.length === 0) return;

    // Mémoriser pour ne pas re-alerter à chaque appel
    [...nouveauxFaibles, ...nouvellesRuptures].forEach(p => this.lastAlertedIds.add(p.id));

    // Notification système Android (avec son)
    if (environment.isCapacitor && this.permissionGranted) {
      await this.envoyerNotifSystème(nouvellesRuptures, nouveauxFaibles);
    }

    // Toast in-app pour chaque produit en rupture
    for (const p of nouvellesRuptures) {
      await this.showToast(`🚨 Rupture : ${p.nom} (stock = 0)`, 'danger');
    }
    // Toast récapitulatif pour stock faible
    if (nouveauxFaibles.length > 0) {
      const noms = nouveauxFaibles.slice(0, 3).map(p => p.nom).join(', ');
      const suite = nouveauxFaibles.length > 3 ? ` +${nouveauxFaibles.length - 3} autres` : '';
      await this.showToast(`⚠️ Stock bas : ${noms}${suite}`, 'warning');
    }
  }

  private async envoyerNotifSystème(ruptures: Produit[], faibles: Produit[]): Promise<void> {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const notifs: any[] = [];

      if (ruptures.length > 0) {
        notifs.push({
          id: this.notifId++,
          title: '🚨 Rupture de stock !',
          body: ruptures.length === 1
            ? `${ruptures[0].nom} est en rupture totale`
            : `${ruptures.length} produits en rupture de stock`,
          sound: 'default',
          importance: 5,
          smallIcon: 'ic_stat_icon_config_sample',
          channelId: 'stock-alerts',
        });
      }

      if (faibles.length > 0) {
        notifs.push({
          id: this.notifId++,
          title: '⚠️ Stock bas',
          body: faibles.length === 1
            ? `${faibles[0].nom} : ${faibles[0].quantite} restant(s)`
            : `${faibles.length} produits ont un stock insuffisant`,
          sound: 'default',
          importance: 4,
          smallIcon: 'ic_stat_icon_config_sample',
          channelId: 'stock-alerts',
        });
      }

      if (notifs.length > 0) {
        await LocalNotifications.schedule({ notifications: notifs });
      }
    } catch { /* ignoré si plugin absent */ }
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color,
      position: 'top',
      buttons: [{ icon: 'close', role: 'cancel' }]
    });
    await toast.present();
  }

  resetAlertes(): void {
    this.lastAlertedIds.clear();
  }
}
