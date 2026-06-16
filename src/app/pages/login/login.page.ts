import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { BoutiqueService } from '../../services/boutique.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  username = '';
  password = '';
  boutiqueName = 'Boutique';
  showPassword = false;
  isLoading = false;
  version = environment.version;

  constructor(
    private auth: AuthService,
    private boutique: BoutiqueService,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private router: Router
  ) {}

  ngOnInit() {
    this.boutiqueName = this.boutique.getInfo().nom;
    this.boutique.refreshBoutique().subscribe(info => this.boutiqueName = info.nom);

    if (this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/tabs');
    }
  }

  async login(): Promise<void> {
    if (!this.username.trim() || !this.password.trim()) {
      this.presentToast('Nom utilisateur et mot de passe obligatoires', 'danger');
      return;
    }

    const loader = await this.loadingCtrl.create({ message: 'Connexion...' });
    await loader.present();
    this.isLoading = true;

    this.auth.signin({
      username: this.username.trim(),
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
          header: `Bienvenue, ${nom} !`,
          message: `${roleLabel}\n${boutique}`,
          cssClass: 'welcome-alert',
          buttons: [{ text: 'OK', cssClass: 'alert-btn-primary', handler: () => this.router.navigateByUrl('/tabs') }]
        });
        await alert.present();
      },
      error: async error => {
        this.isLoading = false;
        await loader.dismiss();
        this.presentToast(error.message || 'Connexion impossible', 'danger');
      }
    });
  }

  useDemo(role: 'admin' | 'vendeur'): void {
    this.username = role;
    this.password = role === 'admin' ? 'admin123' : 'vendeur123';
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2200,
      position: 'top'
    });
    await toast.present();
  }
}
