import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { BoutiqueInfo, BoutiqueService, PermissionVendeur } from '../../services/boutique.service';
import { FonctionnaliteService } from '../../services/fonctionnalite.service';
import { FideliteService, ParametresFidelite } from '../../services/fidelite.service';

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
  conditionnementActif = false;
  // Permission vendeur "Inventaire en lecture seule" (système générique séparé —
  // décision d'un admin normal, pas besoin de super admin).
  inventaireLectureActive = false;

  // Programme de fidélité (CleFonctionnalite.PROGRAMME_FIDELITE) — désactivable par le
  // super admin (voir BoutiqueService.fonctionnalitesAvancees$, système déjà utilisé pour
  // Dépôt garde/Comptes bancaires). Les taux eux-mêmes sont modifiables par un admin normal
  // (PUT /api/fidelite/parametres), pas besoin de super admin.
  programmeFideliteActif = false;
  fideliteForm: ParametresFidelite = { montantParPoint: 0, pointValeur: 0 };
  loadingFidelite = false;
  savingFidelite = false;

  constructor(
    private boutique: BoutiqueService,
    private toastCtrl: ToastController,
    private fonctionnalite: FonctionnaliteService,
    private fideliteService: FideliteService
  ) {}

  ngOnInit(): void {
    this.conditionnementActif = this.fonctionnalite.isConditionnementActif();
  }

  ionViewWillEnter(): void {
    this.conditionnementActif = this.fonctionnalite.isConditionnementActif();
    this.boutique.refreshBoutique().subscribe(info => {
      this.form = { ...info };
      this.previewLogo = info.logoUrl || info.logoPath || '';
    });
    this.boutique.chargerPermissionsVendeur().subscribe((liste: PermissionVendeur[]) => {
      this.inventaireLectureActive = liste.find(p => p.cle === 'INVENTAIRE_LECTURE')?.actif === true;
    });
    this.boutique.chargerFonctionnalitesAvancees().subscribe(liste => {
      this.programmeFideliteActif = liste.find(f => f.cle === 'PROGRAMME_FIDELITE')?.actif === true;
      if (this.programmeFideliteActif) {
        this.loadingFidelite = true;
        this.fideliteService.getParametres().subscribe({
          next: params => { this.fideliteForm = params; this.loadingFidelite = false; },
          error: () => { this.loadingFidelite = false; }
        });
      }
    });
  }

  enregistrerFidelite(): void {
    this.savingFidelite = true;
    this.fideliteService.modifierParametres(this.fideliteForm).subscribe({
      next: params => {
        this.fideliteForm = params;
        this.savingFidelite = false;
        this.presentToast('Taux de fidélité mis à jour');
      },
      error: error => {
        this.savingFidelite = false;
        this.presentToast(error.message || 'Mise à jour impossible', 'danger');
      }
    });
  }

  toggleConditionnement(event: any): void {
    const actif = event.detail.checked;
    this.fonctionnalite.setConditionnement(actif);
    this.conditionnementActif = actif;
    this.presentToast(actif ? 'Conditionnement activé' : 'Conditionnement désactivé');
  }

  toggleInventaireLecture(event: any): void {
    const actif = event.detail.checked;
    this.boutique.definirPermissionVendeur('INVENTAIRE_LECTURE', actif).subscribe({
      next: () => {
        this.inventaireLectureActive = actif;
        this.presentToast(actif ? 'Le vendeur peut désormais consulter l\'inventaire' : 'Accès vendeur à l\'inventaire retiré');
      },
      error: error => {
        this.inventaireLectureActive = !actif;
        this.presentToast(error.message || 'Mise à jour impossible', 'danger');
      }
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
