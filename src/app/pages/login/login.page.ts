import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { BoutiqueService } from '../../services/boutique.service';
import { Language, LanguageService, LANGUAGES } from '../../services/language.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  identifier = '';  // email, téléphone ou identifiant
  password = '';
  boutiqueName = 'Boutique';
  showPassword = false;
  isLoading = false;
  showLangMenu = false;
  version = environment.version;

  readonly languages: Language[] = LANGUAGES;

  constructor(
    private auth: AuthService,
    private boutique: BoutiqueService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private router: Router,
    public langService: LanguageService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.boutiqueName = this.boutique.getInfo().nom;
    this.boutique.refreshBoutique().subscribe(info => this.boutiqueName = info.nom);
    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/tabs');
    }
  }

  selectLang(code: string): void {
    this.langService.setLanguage(code);
    this.showLangMenu = false;
  }

  // Détecte si l'identifiant est un email, un numéro de téléphone ou un username
  private resolveUsername(identifier: string): string {
    const trimmed = identifier.trim();
    // email
    if (trimmed.includes('@')) return trimmed;
    // téléphone : chiffres, espaces, +, tirets
    if (/^[\d\s+\-().]{6,}$/.test(trimmed)) return trimmed.replace(/[\s\-().]/g, '');
    return trimmed;
  }

  async login(): Promise<void> {
    if (!this.identifier.trim() || !this.password.trim()) {
      const msg = await this.translate.get('LOGIN.ERROR_REQUIRED').toPromise();
      this.presentToast(msg, 'danger');
      return;
    }

    const loadMsg = await this.translate.get('LOGIN.LOADING').toPromise();
    const loader = await this.loadingCtrl.create({ message: loadMsg });
    await loader.present();
    this.isLoading = true;

    this.auth.signin({
      username: this.resolveUsername(this.identifier),
      password: this.password
    }).subscribe({
      next: async () => {
        this.isLoading = false;
        await loader.dismiss();
        const user = this.auth.getUser();
        const nom = user?.nomComplet || user?.username || 'Utilisateur';
        const role = (user?.role || '').replace('ROLE_', '');
        const roleLabel = role === 'ADMIN' ? '👑 Administrateur' : '🛒 Vendeur';
        const boutique = this.boutique.getInfo().nom || 'Boutique';

        const alert = await this.alertCtrl.create({
          header: this.translate.instant('LOGIN.WELCOME', { name: nom }),
          message: `${roleLabel}\n${boutique}`,
          cssClass: 'welcome-alert',
          buttons: [{ text: 'OK', cssClass: 'alert-btn-primary', handler: () => this.router.navigateByUrl('/tabs') }]
        });
        await alert.present();
      },
      error: async error => {
        this.isLoading = false;
        await loader.dismiss();
        const errMsg = error.message || this.translate.instant('LOGIN.ERROR_FAILED');
        this.presentToast(errMsg, 'danger');
      }
    });
  }

  useDemo(role: 'admin' | 'vendeur'): void {
    this.identifier = role;
    this.password = role === 'admin' ? 'admin123' : 'vendeur123';
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
