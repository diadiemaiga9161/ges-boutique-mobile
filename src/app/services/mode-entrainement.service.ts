import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const CLE = 'mode_entrainement';

/**
 * Mode entraînement (fonctionnalité MODE_ENTRAINEMENT) : le vendeur fait des ventes « pour du
 * faux ». Tant qu'il est allumé, aucune demande de modification ne part vers le serveur
 * (voir EntrainementInterceptor) et la synchronisation hors ligne est mise en pause.
 */
@Injectable({ providedIn: 'root' })
export class ModeEntrainementService {
  private sujet = new BehaviorSubject<boolean>(this.lire());
  actif$ = this.sujet.asObservable();

  constructor() {
    this.appliquerClasse(this.sujet.value);
  }

  /** État lu directement (pour les services d'arrière-plan, sans injection). */
  static estActif(): boolean {
    try { return localStorage.getItem(CLE) === '1'; } catch { return false; }
  }

  get actif(): boolean {
    return this.sujet.value;
  }

  activer(): void {
    this.ecrire(true);
  }

  desactiver(): void {
    this.ecrire(false);
  }

  private ecrire(v: boolean): void {
    try {
      if (v) localStorage.setItem(CLE, '1');
      else localStorage.removeItem(CLE);
    } catch { /* stockage indisponible : l'état reste en mémoire */ }
    this.appliquerClasse(v);
    this.sujet.next(v);
  }

  private appliquerClasse(v: boolean): void {
    document.body.classList.toggle('mode-entrainement', v);
  }

  private lire(): boolean {
    try { return localStorage.getItem(CLE) === '1'; } catch { return false; }
  }
}
