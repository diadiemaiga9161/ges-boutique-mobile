import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { AuthService, User } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  user: User | null = null;
  form = { nomComplet: '', email: '', telephone: '', password: '' };
  loading = false;
  loadingPhoto = false;
  showPassword = false;
  photoPreview: string | null = null;

  constructor(
    public auth: AuthService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.load();
  }

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    this.user = this.auth.getUser();
    if (this.user) {
      this.form = {
        nomComplet: this.user.nomComplet || '',
        email: this.user.email || '',
        telephone: this.user.telephone || '',
        password: ''
      };
      this.photoPreview = this.user.photo || null;
    }

    this.auth.getCurrentProfile().subscribe({
      next: user => {
        this.user = user;
        this.form = {
          nomComplet: user.nomComplet || '',
          email: user.email || '',
          telephone: user.telephone || '',
          password: ''
        };
        this.photoPreview = user.photo || null;
      },
      error: () => {}
    });
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.presentToast('Sélectionnez une image (JPG, PNG...)', 'danger');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const original = e.target?.result as string;
      this.compressImage(original, 200, 200).then(compressed => {
        this.photoPreview = compressed;
        this.uploadPhoto(compressed);
      });
    };
    reader.readAsDataURL(file);
  }

  private compressImage(src: string, maxW: number, maxH: number): Promise<string> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxW) { h = (h * maxW) / w; w = maxW; }
        if (h > maxH) { w = (w * maxH) / h; h = maxH; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = src;
    });
  }

  uploadPhoto(base64: string): void {
    this.loadingPhoto = true;
    this.auth.updatePhoto(base64).subscribe({
      next: () => { this.loadingPhoto = false; this.presentToast('Photo mise à jour ✓'); },
      error: () => { this.loadingPhoto = false; this.presentToast('Erreur lors de la mise à jour de la photo', 'danger'); }
    });
  }

  removePhoto(): void {
    this.photoPreview = null;
    this.uploadPhoto('');
  }

  save(): void {
    if (!this.validateForm()) return;

    const payload: any = {};
    if (this.form.nomComplet !== this.user?.nomComplet) payload.nomComplet = this.form.nomComplet;
    if (this.form.email !== this.user?.email) payload.email = this.form.email;
    if (this.form.telephone !== this.user?.telephone) payload.telephone = this.form.telephone;
    if (this.form.password) payload.password = this.form.password;

    if (Object.keys(payload).length === 0) {
      this.presentToast('Aucune modification détectée', 'danger');
      return;
    }

    this.loading = true;
    this.auth.updateProfile(payload).subscribe({
      next: user => {
        this.loading = false;
        this.user = user;
        this.form.password = '';
        this.presentToast('Profil mis à jour');
      },
      error: error => {
        this.loading = false;
        this.presentToast(error.message || 'Mise à jour impossible', 'danger');
      }
    });
  }

  logout(): void {
    this.auth.signout();
  }

  getFormattedRole(): string {
    return (this.user?.role || '').replace('ROLE_', '');
  }

  get isFormValid(): boolean {
    return !!(this.form.nomComplet?.trim() && this.form.email?.trim() && this.form.telephone?.trim());
  }

  private validateForm(): boolean {
    if (!this.form.nomComplet.trim()) {
      this.presentToast('Le nom complet est obligatoire', 'danger');
      return false;
    }
    if (!this.form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email)) {
      this.presentToast('Email invalide', 'danger');
      return false;
    }
    if (!this.form.telephone.trim()) {
      this.presentToast('Le téléphone est obligatoire', 'danger');
      return false;
    }
    if (this.form.password && this.form.password.length < 6) {
      this.presentToast('Le mot de passe doit faire au moins 6 caractères', 'danger');
      return false;
    }
    return true;
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
