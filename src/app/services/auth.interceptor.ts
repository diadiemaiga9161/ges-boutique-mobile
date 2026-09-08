import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from './auth.service';
import { NetworkStatusService } from './network-status.service';

// Affiche "Mise à jour en cours" au plus une fois toutes les 10s — évite d'empiler
// plusieurs toasts identiques quand plusieurs requêtes échouent en même temps
// pendant le court redémarrage du serveur (déploiement d'une nouvelle version).
let dernierToastServeurIndisponible = 0;

// Même principe pour "fonctionnalité désactivée" — une page peut déclencher plusieurs
// requêtes vers le même contrôleur désactivé (ex: chargement initial).
let dernierAlertFonctionnaliteDesactivee = 0;

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private auth: AuthService,
    private router: Router,
    private networkStatus: NetworkStatusService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.isPublicRoute(request.url)) {
      return next.handle(request);
    }

    const token = this.auth.getToken();

    // Anti-cache pour Android WebView : timestamp unique sur chaque GET
    const withCacheBust = request.method === 'GET'
      ? request.clone({ params: request.params.set('_t', Date.now().toString()) })
      : request;

    const cloned = token
      ? withCacheBust.clone({
          setHeaders: withCacheBust.body instanceof FormData
            ? { Authorization: `Bearer ${token}` }
            : { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
      : withCacheBust;

    return next.handle(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Token expiré ou invalide : là seulement on déconnecte.
          this.auth.signout();
          this.router.navigateByUrl('/login');
          return throwError(() => new Error('Session expirée. Veuillez vous reconnecter.'));
        }

        if (error.status === 403) {
          // BUG CORRIGÉ : un 403 (session valide mais action non autorisée) était
          // traité comme un 401 et déconnectait l'utilisateur — un vendeur qui
          // heurtait une fonctionnalité désactivée ou une action réservée à l'admin
          // se retrouvait renvoyé à l'écran de connexion au lieu de voir simplement
          // pourquoi c'est refusé. On reste connecté et on affiche le message du serveur.
          if ((error.error as any)?.errorCode === 'FEATURE_DISABLED') {
            // Le message détaillé arrive dans "message" (GlobalExceptionHandler) pour
            // la plupart des contrôleurs, mais dans "error" pour ceux qui ont leur
            // propre gestionnaire local (ex: DetteAncienneController) — on vérifie les deux.
            const detail = (error.error as any)?.message || (error.error as any)?.error;
            this.afficherFonctionnaliteDesactivee(detail);
          }
          return throwError(() => error);
        }

        if (error.status === 0) {
          // Aucune réponse HTTP du tout : soit le téléphone n'a pas de réseau, soit le
          // réseau est bon mais LE SERVEUR de cette boutique ne répond pas — cas
          // typique d'un redémarrage après déploiement (10-20s). NetworkStatusService
          // (Capacitor) permet de distinguer les deux cas de façon fiable sur mobile.
          this.signalerServeurIndisponibleSiPertinent();
        }

        return throwError(() => error);
      })
    );
  }

  private isPublicRoute(url: string): boolean {
    return ['/api/auth/login', '/api/auth/register', '/swagger-ui', '/v3/api-docs']
      .some(route => url.includes(route));
  }

  private async afficherFonctionnaliteDesactivee(message?: string): Promise<void> {
    const maintenant = Date.now();
    if (maintenant - dernierAlertFonctionnaliteDesactivee <= 10000) return;
    dernierAlertFonctionnaliteDesactivee = maintenant;

    const alert = await this.alertCtrl.create({
      header: 'Fonctionnalité désactivée',
      message: message || "Cette fonctionnalité est désactivée par le super admin de la boutique. Pour plus d'informations, contactez Maiga Consulting.",
      buttons: ['Compris']
    });
    await alert.present();
  }

  private async signalerServeurIndisponibleSiPertinent(): Promise<void> {
    if (!this.networkStatus.isOnline()) return;
    const maintenant = Date.now();
    if (maintenant - dernierToastServeurIndisponible <= 10000) return;
    dernierToastServeurIndisponible = maintenant;

    const toast = await this.toastCtrl.create({
      message: 'Mise à jour en cours, veuillez patienter quelques instants...',
      color: 'warning',
      duration: 6000,
      position: 'top'
    });
    await toast.present();
  }
}
