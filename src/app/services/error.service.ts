import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class ErrorService {

  constructor(private toastCtrl: ToastController) {}

  getMessage(err: any): string {
    const code = err?.error?.code || err?.error?.message;
    const status = err?.status;

    if (status === 0) return 'Pas de connexion internet — vos données locales restent disponibles';

    const messages: Record<string, string> = {
      'WRONG_PASSWORD': 'Mot de passe incorrect',
      'USER_NOT_FOUND': 'Ce compte n\'existe pas',
      'INSUFFICIENT_STOCK': 'Stock insuffisant',
      'OPTIMISTIC_LOCK_CONFLICT': 'Le stock a été modifié simultanément — veuillez réessayer',
      'UNAUTHORIZED': 'Session expirée — veuillez vous reconnecter',
      'BOUTIQUE_NOT_FOUND': 'Boutique introuvable',
      'PRODUIT_NOT_FOUND': 'Produit introuvable',
      'VALIDATION_ERROR': err?.error?.message || 'Données invalides',
      'CREDIT_ALREADY_SETTLED': 'Ce crédit est déjà réglé',
    };

    if (code && messages[code]) return messages[code];
    if (err?.error?.message) return err.error.message;
    if (status === 401) return 'Session expirée — veuillez vous reconnecter';
    if (status === 403) return 'Accès refusé';
    if (status === 404) return 'Ressource introuvable';
    if (status >= 500) return 'Erreur serveur — veuillez réessayer dans quelques instants';
    return 'Une erreur est survenue — veuillez réessayer';
  }

  async afficherErreur(err: any, options?: { duration?: number }): Promise<void> {
    const message = this.getMessage(err);
    const toast = await this.toastCtrl.create({
      message,
      duration: options?.duration ?? 3500,
      color: 'danger',
      position: 'top',
      icon: 'alert-circle-outline',
      buttons: [{ text: '✕', role: 'cancel' }]
    });
    await toast.present();
  }

  async afficherSucces(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color: 'success',
      position: 'top',
      icon: 'checkmark-circle-outline'
    });
    await toast.present();
  }
}
