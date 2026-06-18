import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { AuthService, User } from '../../services/auth.service';
import { Language, LanguageService, LANGUAGES } from '../../services/language.service';

export const COUNTRY_CODES = [
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
  { code: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
  { code: '+227', flag: '🇳🇪', name: 'Niger' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+224', flag: '🇬🇳', name: 'Guinée' },
  { code: '+222', flag: '🇲🇷', name: 'Mauritanie' },
  { code: '+245', flag: '🇬🇼', name: 'Guinée-Bissau' },
  { code: '+232', flag: '🇸🇱', name: 'Sierra Leone' },
  { code: '+231', flag: '🇱🇷', name: 'Libéria' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: '+235', flag: '🇹🇩', name: 'Tchad' },
  { code: '+236', flag: '🇨🇫', name: 'Centrafrique' },
  { code: '+241', flag: '🇬🇦', name: 'Gabon' },
  { code: '+242', flag: '🇨🇬', name: 'Congo' },
  { code: '+243', flag: '🇨🇩', name: 'RD Congo' },
  { code: '+212', flag: '🇲🇦', name: 'Maroc' },
  { code: '+213', flag: '🇩🇿', name: 'Algérie' },
  { code: '+216', flag: '🇹🇳', name: 'Tunisie' },
  { code: '+20',  flag: '🇪🇬', name: 'Égypte' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+1',   flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44',  flag: '🇬🇧', name: 'Royaume-Uni' },
  { code: '+32',  flag: '🇧🇪', name: 'Belgique' },
  { code: '+41',  flag: '🇨🇭', name: 'Suisse' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal' },
  { code: '+34',  flag: '🇪🇸', name: 'Espagne' },
  { code: '+49',  flag: '🇩🇪', name: 'Allemagne' },
  { code: '+86',  flag: '🇨🇳', name: 'Chine' },
];

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit {
  user: User | null = null;
  form = { nomComplet: '', email: '', telephone: '', password: '' };
  selectedCountryCode = '+223';
  loading = false;
  loadingPhoto = false;
  showPassword = false;
  photoPreview: string | null = null;

  readonly languages: Language[] = LANGUAGES;
  readonly countryCodes = COUNTRY_CODES;

  constructor(
    public auth: AuthService,
    public langService: LanguageService,
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
      this.fillForm(this.user);
      this.photoPreview = this.user.photo || null;
    }

    this.auth.getCurrentProfile().subscribe({
      next: user => {
        this.user = user;
        this.fillForm(user);
        this.photoPreview = user.photo || null;
      },
      error: () => {}
    });
  }

  private fillForm(user: User): void {
    const tel = user.telephone || '';
    const matched = COUNTRY_CODES.find(c => tel.startsWith(c.code));
    if (matched) {
      this.selectedCountryCode = matched.code;
      this.form = { nomComplet: user.nomComplet || '', email: user.email || '', telephone: tel.slice(matched.code.length).trim(), password: '' };
    } else {
      this.form = { nomComplet: user.nomComplet || '', email: user.email || '', telephone: tel, password: '' };
    }
  }

  getFullPhone(): string {
    return this.selectedCountryCode + this.form.telephone.replace(/^0+/, '');
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
    const fullPhone = this.getFullPhone();
    if (fullPhone !== this.user?.telephone) payload.telephone = fullPhone;
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
