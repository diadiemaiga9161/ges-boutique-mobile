import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { ParametresService, StatutParametres, SelectionParametres } from '../../services/parametres.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-parametres',
  templateUrl: './parametres.page.html',
  styleUrls: ['./parametres.page.scss'],
  standalone: false
})
export class ParametresPage {
  statut: StatutParametres = {
    nombreOperationsCaisse: 0,
    soldeCaisseActuel: 0,
    nombreCreditsRegles: 0,
    nombreVentesAnnulees: 0
  };

  loading = false;
  enCours = false;

  selection: SelectionParametres = {
    soldeCaisse: false,
    historiqueOperationsCaisse: false,
    creditsRegles: false,
    historiqueVentesAnnulees: false
  };

  isAdmin = false;

  constructor(
    private parametresService: ParametresService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private translate: TranslateService
  ) {}

  ionViewWillEnter(): void {
    this.isAdmin = this.auth.isAdmin();
    if (this.isAdmin) {
      this.chargerStatut();
    }
  }

  chargerStatut(): void {
    this.loading = true;
    this.parametresService.getStatut().subscribe({
      next: data => {
        this.statut = data;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.afficherToast('PARAMETRES.ERREUR', 'danger');
      }
    });
  }

  get aucuneSelection(): boolean {
    return !this.selection.soldeCaisse &&
      !this.selection.historiqueOperationsCaisse &&
      !this.selection.creditsRegles &&
      !this.selection.historiqueVentesAnnulees;
  }

  async confirmerReinitialiser(): Promise<void> {
    if (this.aucuneSelection) {
      this.afficherToast('PARAMETRES.AUCUNE_SELECTION', 'warning');
      return;
    }

    const titreKey = await this.translate.get('PARAMETRES.REINITIALISER').toPromise();
    const messageKey = await this.translate.get('PARAMETRES.CONFIRM_REINIT_MSG').toPromise();
    const oui = await this.translate.get('COMMON.YES').toPromise();
    const non = await this.translate.get('COMMON.CANCEL').toPromise();

    const alert = await this.alertCtrl.create({
      header: titreKey,
      message: messageKey,
      buttons: [
        { text: non, role: 'cancel' },
        {
          text: oui,
          role: 'confirm',
          handler: () => this.executerReinitialiser()
        }
      ]
    });
    await alert.present();
  }

  private executerReinitialiser(): void {
    this.enCours = true;
    this.parametresService.reinitialiser(this.selection).subscribe({
      next: () => {
        this.enCours = false;
        this.afficherToast('PARAMETRES.SUCCES', 'success');
        this.chargerStatut();
      },
      error: () => {
        this.enCours = false;
        this.afficherToast('PARAMETRES.ERREUR', 'danger');
      }
    });
  }

  async confirmerSupprimer(): Promise<void> {
    if (this.aucuneSelection) {
      this.afficherToast('PARAMETRES.AUCUNE_SELECTION', 'warning');
      return;
    }

    const titreKey = await this.translate.get('PARAMETRES.SUPPRIMER').toPromise();
    const messageKey = await this.translate.get('PARAMETRES.CONFIRM_DELETE_MSG').toPromise();
    const labelKey = await this.translate.get('PARAMETRES.CONFIRMER').toPromise();
    const oui = await this.translate.get('PARAMETRES.SUPPRIMER').toPromise();
    const non = await this.translate.get('COMMON.CANCEL').toPromise();

    const alert = await this.alertCtrl.create({
      header: titreKey,
      message: messageKey,
      inputs: [
        {
          name: 'confirmation',
          type: 'text',
          placeholder: labelKey
        }
      ],
      buttons: [
        { text: non, role: 'cancel' },
        {
          text: oui,
          role: 'confirm',
          handler: data => {
            if (data.confirmation === 'CONFIRMER') {
              this.executerSupprimer();
              return true;
            } else {
              this.afficherToast('PARAMETRES.MOT_INCORRECT', 'warning');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private executerSupprimer(): void {
    this.enCours = true;
    this.parametresService.supprimer(this.selection).subscribe({
      next: () => {
        this.enCours = false;
        this.afficherToast('PARAMETRES.SUCCES', 'success');
        this.chargerStatut();
      },
      error: () => {
        this.enCours = false;
        this.afficherToast('PARAMETRES.ERREUR', 'danger');
      }
    });
  }

  private async afficherToast(cle: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const message = await this.translate.get(cle).toPromise();
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  formatMontant(valeur: number): string {
    return new Intl.NumberFormat('fr-FR').format(valeur || 0) + ' F CFA';
  }
}
