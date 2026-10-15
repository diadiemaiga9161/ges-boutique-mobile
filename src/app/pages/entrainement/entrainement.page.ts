import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ModeEntrainementService } from '../../services/mode-entrainement.service';

/** Allumer / éteindre le mode entraînement (ventes « pour du faux »). */
@Component({
  selector: 'app-entrainement',
  templateUrl: './entrainement.page.html',
  styleUrls: ['./entrainement.page.scss'],
  standalone: false
})
export class EntrainementPage {
  constructor(public entrainement: ModeEntrainementService, private router: Router) {}

  basculer(): void {
    if (this.entrainement.actif) this.entrainement.desactiver();
    else this.entrainement.activer();
  }

  allerALaCaisse(): void {
    this.router.navigateByUrl('/cart');
  }
}
