import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

/** Page "table des matières" des réglages : ne centralise aucune logique
 *  métier, se contente de renvoyer vers les pages existantes (Profil,
 *  Langue, Notifications, Boutique...) qui restent la source de vérité de
 *  chaque réglage. Aucun appel API ici, donc pas besoin de ionViewWillEnter. */
@Component({
  selector: 'app-parametres-hub',
  templateUrl: './parametres-hub.page.html',
  styleUrls: ['./parametres-hub.page.scss'],
  standalone: false
})
export class ParametresHubPage {
  constructor(public auth: AuthService) {}
}
