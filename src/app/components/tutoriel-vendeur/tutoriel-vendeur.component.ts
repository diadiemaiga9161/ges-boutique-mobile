import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BoutiqueService } from '../../services/boutique.service';
import { TutorielVendeurService } from '../../services/tutoriel-vendeur.service';

/** Tutoriel d'accueil pour un nouveau vendeur — overlay wizard 4 étapes,
 *  monté une seule fois à la racine (app.component.html), hors de
 *  ion-router-outlet, sur le même principe que app-offline-status /
 *  app-pwa-install. S'affiche automatiquement au premier login d'un
 *  utilisateur VENDEUR (jamais ADMIN) tant que la clé locale
 *  `tutoriel_vendeur_vu_{userId}` est absente, et peut être rouvert
 *  manuellement via le bouton "Revoir le tutoriel" du Profil. */
@Component({
  selector: 'app-tutoriel-vendeur',
  standalone: true,
  imports: [CommonModule, IonicModule, TranslateModule],
  templateUrl: './tutoriel-vendeur.component.html',
  styleUrls: ['./tutoriel-vendeur.component.scss']
})
export class TutorielVendeurComponent implements OnInit, OnDestroy {
  visible = false;
  step = 1;
  readonly totalSteps = 4;

  boutiqueNom = '';
  roleLabel = '';

  private authSub?: Subscription;
  private demandeSub?: Subscription;

  constructor(
    private auth: AuthService,
    private boutique: BoutiqueService,
    private tutoriel: TutorielVendeurService
  ) {}

  ngOnInit(): void {
    // Affichage auto : à chaque passage à "authentifié" (login, ou session
    // déjà active au démarrage de l'app), on vérifie si ce vendeur précis
    // n'a jamais vu le tutoriel sur cet appareil.
    this.authSub = this.auth.authenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.verifierAffichageAuto();
      }
    });

    // Réaffichage manuel demandé depuis Profil ("Revoir le tutoriel").
    this.demandeSub = this.tutoriel.demandeAffichage$.subscribe(() => {
      this.ouvrir();
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.demandeSub?.unsubscribe();
  }

  private verifierAffichageAuto(): void {
    if (!this.auth.isVendeur()) return;

    const userId = this.auth.getUserId();
    if (!userId || this.tutoriel.estDejaVu(userId)) return;

    this.ouvrir();
  }

  private ouvrir(): void {
    this.boutiqueNom = this.boutique.getInfo()?.nom || '';
    this.roleLabel = this.auth.getFormattedRole() || 'Vendeur';
    this.step = 1;
    this.visible = true;
  }

  suivant(): void {
    if (this.step < this.totalSteps) {
      this.step++;
    } else {
      this.terminer();
    }
  }

  precedent(): void {
    if (this.step > 1) {
      this.step--;
    }
  }

  /** Bouton final "Compris, commencer" ET croix de fermeture : les deux
   *  ferment l'overlay et marquent la clé locale comme vue. */
  terminer(): void {
    const userId = this.auth.getUserId();
    if (userId) {
      this.tutoriel.marquerCommeVu(userId);
    }
    this.visible = false;
  }
}
