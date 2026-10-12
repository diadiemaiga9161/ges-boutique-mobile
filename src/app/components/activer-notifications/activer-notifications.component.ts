import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { EtatNotificationsPush, NotificationsPushService } from '../../services/notifications-push.service';

const CLE_PLUS_TARD = 'notif-push-plus-tard';
const DELAI_PLUS_TARD = 7 * 24 * 3600 * 1000;

/**
 * « Activer les notifications sur ce téléphone ».
 * mode « bandeau » (accueil) : visible seulement si c'est possible et pas encore fait ; « Plus tard » le cache 7 jours.
 * mode « reglage » (page Notifications) : état du téléphone, activer / désactiver, aide si refusé.
 */
@Component({
  selector: 'app-activer-notifications',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './activer-notifications.component.html',
  styleUrls: ['./activer-notifications.component.scss']
})
export class ActiverNotificationsComponent implements OnInit {
  @Input() mode: 'bandeau' | 'reglage' = 'bandeau';

  etat: EtatNotificationsPush | null = null;
  enCours = false;
  erreur = '';
  masque = false;
  readonly iphone = /iphone|ipad|ipod/i.test(navigator.userAgent);

  constructor(private push: NotificationsPushService) {}

  async ngOnInit(): Promise<void> {
    try {
      const plusTard = Number(localStorage.getItem(CLE_PLUS_TARD) || 0);
      this.masque = this.mode === 'bandeau' && Date.now() - plusTard < DELAI_PLUS_TARD;
    } catch { this.masque = false; }
    this.etat = await this.push.etat();
    if (this.etat === 'actif') this.push.resynchroniser();
    if (this.etat === 'inactif') this.push.preparer();
  }

  get visible(): boolean {
    if (this.etat === null) return false;
    if (this.mode === 'reglage') return true;
    return this.etat === 'inactif' && !this.masque;
  }

  async activer(): Promise<void> {
    this.enCours = true;
    this.erreur = '';
    try {
      this.etat = await this.push.activer();
    } catch {
      this.erreur = 'Activation impossible pour le moment. Vérifiez la connexion et réessayez.';
    } finally {
      this.enCours = false;
    }
  }

  async desactiver(): Promise<void> {
    this.enCours = true;
    try {
      await this.push.desactiver();
      this.etat = await this.push.etat();
    } finally {
      this.enCours = false;
    }
  }

  plusTard(): void {
    this.masque = true;
    try { localStorage.setItem(CLE_PLUS_TARD, String(Date.now())); } catch { /* sans stockage, le bandeau reviendra */ }
  }
}
