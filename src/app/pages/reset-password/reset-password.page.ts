import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  standalone: false
})
export class ResetPasswordPage implements OnInit {
  token = '';
  tokenValide: boolean | null = null;
  password = '';
  confirm = '';
  isLoading = false;
  successMessage = '';
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) { this.tokenValide = false; return; }
    this.authService.verifierTokenReset(this.token).subscribe({
      next: res => this.tokenValide = res.valide,
      error: () => this.tokenValide = false
    });
  }

  submit(): void {
    if (!this.password || this.password.length < 6) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 6 caractères';
      return;
    }
    if (this.password !== this.confirm) {
      this.errorMessage = 'Les mots de passe ne correspondent pas';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.authService.reinitialiserPassword(this.token, this.password).subscribe({
      next: res => {
        this.isLoading = false;
        this.successMessage = res.message;
        setTimeout(() => this.router.navigateByUrl('/login'), 3000);
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
