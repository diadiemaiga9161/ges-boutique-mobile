import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

const KEY_PREFIX = 'tutoriel_vendeur_vu_';

/** Tutoriel d'accueil vendeur — même style que FonctionnaliteService :
 *  une clé localStorage simple par utilisateur (tutoriel_vendeur_vu_{userId}).
 *  Absence de clé = jamais vu = le wizard s'affiche au prochain login. */
@Injectable({ providedIn: 'root' })
export class TutorielVendeurService {

  private demandeAffichageSubject = new Subject<void>();
  /** Émis quand l'utilisateur demande explicitement de revoir le tutoriel
   *  (bouton "Revoir le tutoriel" dans Profil). */
  demandeAffichage$ = this.demandeAffichageSubject.asObservable();

  estDejaVu(userId: number): boolean {
    if (!userId) return false;
    return localStorage.getItem(KEY_PREFIX + userId) === 'true';
  }

  marquerCommeVu(userId: number): void {
    if (!userId) return;
    localStorage.setItem(KEY_PREFIX + userId, 'true');
  }

  demanderAffichage(): void {
    this.demandeAffichageSubject.next();
  }
}
