import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { BoutiqueInfo, BoutiqueService } from '../../services/boutique.service';

@Component({
  selector: 'app-boutique-settings',
  templateUrl: './boutique-settings.page.html',
  styleUrls: ['./boutique-settings.page.scss'],
  standalone: false
})
export class BoutiqueSettingsPage implements OnInit {
  form: BoutiqueInfo = this.boutique.getInfo();
  previewLogo = '';
  selectedLogoFile: File | null = null;
  saving = false;
  uploadingLogo = false;

  constructor(
    private boutique: BoutiqueService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.boutique.refreshBoutique().subscribe(info => {
      this.form = { ...info };
      this.previewLogo = info.logoUrl || info.logoPath || '';
    });
  }

  onLogoFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      this.presentToast('Logo trop volumineux (max 5MB)', 'danger');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '')) {
      this.presentToast('Format non supporté. Utilisez JPG, PNG ou WebP', 'danger');
      return;
    }

    this.selectedLogoFile = file;
    const reader = new FileReader();
    reader.onload = (e) => this.previewLogo = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  uploadLogo(): void {
    if (!this.selectedLogoFile) return;
    this.uploadingLogo = true;
    this.boutique.uploadLogo(this.selectedLogoFile).subscribe({
      next: logoUrl => {
        this.form.logoUrl = logoUrl;
        this.form.logoPath = logoUrl;
        this.previewLogo = logoUrl;
        this.uploadingLogo = false;
        this.selectedLogoFile = null;
        this.presentToast('Logo mis à jour');
      },
      error: error => {
        this.uploadingLogo = false;
        this.presentToast(error.message || 'Upload impossible', 'danger');
      }
    });
  }

  save(): void {
    if (!this.form.nom?.trim()) {
      this.presentToast('Le nom de la boutique est obligatoire', 'danger');
      return;
    }
    this.saving = true;
    this.boutique.updateBoutique(this.form).subscribe({
      next: info => {
        this.form = { ...info };
        this.saving = false;
        this.presentToast('Boutique mise à jour');
      },
      error: error => {
        this.saving = false;
        this.presentToast(error.message || 'Mise à jour impossible', 'danger');
      }
    });
  }

  reset(): void {
    this.boutique.resetToDefaults().subscribe(info => {
      this.form = { ...info };
      this.presentToast('Paramètres réinitialisés');
    });
  }

  getLogoSrc(): string {
    return this.previewLogo || this.form.logoUrl || this.form.logoPath || '';
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
