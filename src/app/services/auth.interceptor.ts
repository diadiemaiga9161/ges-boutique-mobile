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
import { ToastController } from '@ionic/angular';
import { AuthService } from './auth.service';
import { NetworkStatusService } from './network-status.service';

// Affiche "Mise à jour en cours" au plus une fois toutes les 10s — évite d'empiler
// plusieurs toasts identiques quand plusieurs requêtes échouent en même temps
// pendant le court redémarrage du serveur (déploiement d'une nouvelle version).
let dernierToastServeurIndisponible = 0;

// "Fonctionnalité désactivée" : le message n'est montré qu'une fois par fonction pendant la
// session (avant : une fenêtre revenait à chaque ouverture de page).
const CLE_FONCTIONNALITES_SIGNALEES = 'fonctionnalites-desactivees-signalees';
const fonctionnalitesDesactiveesSignalees = new Set<string>(lireFonctionnalitesSignalees());

function lireFonctionnalitesSignalees(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(CLE_FONCTIONNALITES_SIGNALEES) || '[]');
  } catch {
    return [];
  }
}

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private auth: AuthService,
    private router: Router,
    private networkStatus: NetworkStatusService,
    private toastCtrl: ToastController
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
            // Chargement automatique d'une page (GET) : aucun message, la partie reste vide.
            // Action de la personne (enregistrer, créer...) : petit message, une fois par fonction.
            if (request.method !== 'GET') {
              this.afficherFonctionnaliteDesactivee(detail);
            }
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
    const texte = message || "Cette fonctionnalité est désactivée par le super admin de la boutique. Pour plus d'informations, contactez Maiga Consulting.";
    if (fonctionnalitesDesactiveesSignalees.has(texte)) return;
    fonctionnalitesDesactiveesSignalees.add(texte);
    try {
      sessionStorage.setItem(CLE_FONCTIONNALITES_SIGNALEES, JSON.stringify([...fonctionnalitesDesactiveesSignalees]));
    } catch { /* stockage indisponible : le message pourra revenir après redémarrage */ }

    const toast = await this.toastCtrl.create({
      header: 'Fonctionnalité désactivée',
      message: texte,
      color: 'medium',
      duration: 5000,
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
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
