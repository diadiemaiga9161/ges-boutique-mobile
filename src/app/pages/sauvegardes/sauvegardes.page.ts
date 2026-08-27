import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { BackupService, BackupInfo } from '../../services/backup.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sauvegardes',
  templateUrl: './sauvegardes.page.html',
  styleUrls: ['./sauvegardes.page.scss'],
  standalone: false
})
export class SauvegardesPage {
  isAdmin = false;

  sauvegardes: BackupInfo[] = [];
  loading = false;
  errorMessage = '';

  /** Bloque le bouton "Sauvegarder maintenant" pendant l'appel (mysqldump synchrone côté serveur). */
  declenchement = false;

  /** Nom du fichier en cours de téléchargement/partage (null = aucun). */
  telechargementEnCours: string | null = null;

  constructor(
    private backupService: BackupService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private translate: TranslateService
  ) {}

  ionViewWillEnter(): void {
    this.isAdmin = this.auth.isAdmin();
    if (this.isAdmin) {
      this.charger();
    }
  }

  charger(event?: any): void {
    this.loading = true;
    this.errorMessage = '';
    this.backupService.getListe().subscribe({
      next: liste => {
        this.sauvegardes = liste || [];
        this.loading = false;
        event?.target?.complete();
      },
      error: err => {
        this.errorMessage = err?.message || "Impossible de charger la liste des sauvegardes";
        this.sauvegardes = [];
        this.loading = false;
        event?.target?.complete();
      }
    });
  }

  async confirmerDeclencher(): Promise<void> {
    const titre = await this.translate.get('BACKUP.CONFIRM_TITLE').toPromise();
    const message = await this.translate.get('BACKUP.CONFIRM_TEXT').toPromise();
    const oui = await this.translate.get('COMMON.YES').toPromise();
    const non = await this.translate.get('COMMON.CANCEL').toPromise();

    const alert = await this.alertCtrl.create({
      header: titre,
      message,
      buttons: [
        { text: non, role: 'cancel' },
        { text: oui, role: 'confirm', handler: () => this.declencher() }
      ]
    });
    await alert.present();
  }

  private declencher(): void {
    this.declenchement = true;
    this.backupService.declencher().subscribe({
      next: res => {
        this.declenchement = false;
        if (res?.success) {
          this.toast('BACKUP.SUCCESS_MESSAGE');
          this.charger();
        } else {
          this.toast(res?.message || 'BACKUP.ERROR_MESSAGE', 'danger', !res?.message);
        }
      },
      error: err => {
        this.declenchement = false;
        this.toast(err?.message || 'BACKUP.ERROR_MESSAGE', 'danger', !err?.message);
      }
    });
  }

  async telecharger(item: BackupInfo): Promise<void> {
    if (this.telechargementEnCours) return;
    this.telechargementEnCours = item.nomFichier;
    try {
      await this.backupService.telechargerEtPartager(item.nomFichier);
    } catch (err: any) {
      this.toast(err?.message || 'BACKUP.ERROR_MESSAGE', 'danger', !err?.message);
    } finally {
      this.telechargementEnCours = null;
    }
  }

  formatTaille(octets: number): string {
    return this.backupService.formatTaille(octets);
  }

  formatDate(value?: string): string {
    return this.backupService.formatDate(value);
  }

  trackByNomFichier = (_: number, item: BackupInfo) => item.nomFichier;

  /**
   * @param message soit une clé i18n (traduite via `translateKey=true` ou par défaut),
   *                 soit un message brut déjà résolu (ex: message d'erreur backend).
   */
  private async toast(message: string, color: 'success' | 'danger' = 'success', translateKey = true): Promise<void> {
    const texte = translateKey ? await this.translate.get(message).toPromise() : message;
    const t = await this.toastCtrl.create({ message: texte, color, duration: 2500, position: 'top' });
    await t.present();
  }
}
