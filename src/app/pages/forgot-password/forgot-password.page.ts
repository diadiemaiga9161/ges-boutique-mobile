import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  standalone: false
})
export class ForgotPasswordPage {
  email = '';
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private toastCtrl: ToastController,
    private router: Router
  ) {}

  submit(): void {
    if (!this.email.trim()) {
      this.errorMessage = 'Veuillez entrer votre adresse e-mail';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.motDePasseOublie(this.email.trim()).subscribe({
      next: res => {
        this.isLoading = false;
        this.successMessage = res.message;
      },
      error: err => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Une erreur est survenue';
      }
    });
  }

  retourConnexion(): void {
    this.router.navigateByUrl('/login');
  }
}
