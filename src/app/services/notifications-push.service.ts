import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export type EtatNotificationsPush = 'indisponible' | 'inactif' | 'actif' | 'refuse';

/**
 * Notifications affichées sur l'écran du téléphone, même appli fermée (iPhone : appli ajoutée à
 * l'écran d'accueil ; Android : appli installée depuis Chrome). Le téléphone s'abonne auprès
 * d'Apple ou de Google, puis donne son adresse au serveur de la boutique.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsPushService {

  private clePublique: string | null = null;
  private resynchroniseCetteSession = false;

  constructor(private swPush: SwPush, private http: HttpClient) {}

  supporte(): boolean {
    return this.swPush.isEnabled && typeof window !== 'undefined'
      && 'Notification' in window && 'PushManager' in window;
  }

  async etat(): Promise<EtatNotificationsPush> {
    if (!this.supporte()) return 'indisponible';
    if (Notification.permission === 'denied') return 'refuse';
    const abonnement = await firstValueFrom(this.swPush.subscription);
    return abonnement && Notification.permission === 'granted' ? 'actif' : 'inactif';
  }

  /** À appeler à l'affichage : la clé doit être prête AVANT le toucher (exigence de l'iPhone). */
  async preparer(): Promise<void> {
    if (!this.supporte() || this.clePublique) return;
    try {
      const r = await firstValueFrom(this.http.get<{ clePublique: string }>(`${environment.apiUrl}/push/cle-publique`));
      this.clePublique = r.clePublique;
    } catch {
      this.clePublique = null;
    }
  }

  /** Appelé directement depuis le toucher sur « Activer » (sans attente avant la demande d'autorisation). */
  async activer(): Promise<EtatNotificationsPush> {
    if (!this.supporte()) return 'indisponible';
    if (!this.clePublique) await this.preparer();
    if (!this.clePublique) throw new Error('Clé de notification indisponible');
    try {
      const abonnement = await this.swPush.requestSubscription({ serverPublicKey: this.clePublique });
      await this.envoyerAuServeur(abonnement);
      return 'actif';
    } catch (e) {
      if (Notification.permission === 'denied') return 'refuse';
      throw e;
    }
  }

  async desactiver(): Promise<void> {
    const abonnement = await firstValueFrom(this.swPush.subscription);
    if (abonnement) {
      try {
        await firstValueFrom(this.http.post(`${environment.apiUrl}/push/desabonnement`, { endpoint: abonnement.endpoint }));
      } catch { /* le serveur l'oubliera de lui-même au prochain envoi refusé */ }
    }
    await this.swPush.unsubscribe().catch(() => undefined);
  }

  /** Une fois par session : redonne l'abonnement au serveur (changement de boutique, base restaurée…). */
  async resynchroniser(): Promise<void> {
    if (this.resynchroniseCetteSession || !this.supporte() || Notification.permission !== 'granted') return;
    const abonnement = await firstValueFrom(this.swPush.subscription);
    if (!abonnement) return;
    this.resynchroniseCetteSession = true;
    await this.envoyerAuServeur(abonnement).catch(() => { this.resynchroniseCetteSession = false; });
  }

  private async envoyerAuServeur(abonnement: PushSubscription): Promise<void> {
    await firstValueFrom(this.http.post(`${environment.apiUrl}/push/abonnement`, abonnement.toJSON()));
  }
}
