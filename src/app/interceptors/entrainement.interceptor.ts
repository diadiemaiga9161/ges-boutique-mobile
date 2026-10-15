import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ModeEntrainementService } from '../services/mode-entrainement.service';

/** Seules ces demandes restent permises en entraînement (connexion, déconnexion). */
const PERMIS = ['/auth/', '/push/desabonnement'];
const LECTURE = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Mode entraînement : bloque toute demande qui modifierait quelque chose sur le serveur
 * (vente, stock, caisse, client…). Le refus porte un vrai code (423) pour ne jamais être
 * pris pour une coupure de réseau, sinon la vente serait mise de côté et envoyée plus tard.
 * Le serveur refuse aussi ces demandes grâce à l'en-tête X-Mode-Entrainement.
 */
@Injectable()
export class EntrainementInterceptor implements HttpInterceptor {
  constructor(private entrainement: ModeEntrainementService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.entrainement.actif) return next.handle(req);
    const versApi = req.url.includes('/api/');
    if (versApi && !LECTURE.includes(req.method.toUpperCase()) && !PERMIS.some(p => req.url.includes(p))) {
      return throwError(() => new HttpErrorResponse({
        status: 423,
        statusText: 'Mode entraînement',
        url: req.url,
        error: { message: 'Mode entraînement : rien n\'est enregistré. Arrêtez l\'entraînement pour travailler en vrai.' }
      }));
    }
    return next.handle(versApi ? req.clone({ setHeaders: { 'X-Mode-Entrainement': '1' } }) : req);
  }
}
