import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <div class="pwa-banner" *ngIf="visible" (click)="$event.stopPropagation()">
      <div class="pwa-inner">
        <div class="pwa-icon">
          <img src="assets/icons/icon-72x72.png" alt="icon" />
        </div>
        <div class="pwa-text">
          <p class="pwa-title">Installer Boutique Maiga</p>
          <p class="pwa-sub">Accès rapide depuis votre écran d'accueil</p>
        </div>
        <button class="pwa-btn-install" (click)="install()">Installer</button>
        <button class="pwa-btn-close" (click)="dismiss()" aria-label="Fermer">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .pwa-banner {
      position: fixed;
      bottom: 16px;
      left: 12px;
      right: 12px;
      z-index: 99999;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(26,86,219,0.18), 0 2px 8px rgba(0,0,0,0.1);
      border: 1.5px solid #e8eef8;
      animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(120%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    .pwa-inner {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      gap: 12px;
    }

    .pwa-icon img {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      flex-shrink: 0;
    }

    .pwa-text {
      flex: 1;
      min-width: 0;
    }

    .pwa-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pwa-sub {
      font-size: 0.72rem;
      color: #64748b;
      margin: 0;
    }

    .pwa-btn-install {
      background: #1a56db;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 0.82rem;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s;
    }

    .pwa-btn-install:active { background: #0d47a1; }

    .pwa-btn-close {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      font-size: 1.1rem;
    }
  `]
})
export class PwaInstallComponent implements OnInit, OnDestroy {
  visible = false;
  private deferredPrompt: any = null;
  private handler = (e: any) => {
    e.preventDefault();
    this.deferredPrompt = e;
    const dismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (!dismissed) {
      this.visible = true;
    }
  };

  ngOnInit() {
    window.addEventListener('beforeinstallprompt', this.handler);

    // iOS: pas de beforeinstallprompt — afficher une aide manuelle
    if (this.isIos() && !this.isInStandaloneMode()) {
      const dismissed = sessionStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        this.visible = true;
      }
    }
  }

  ngOnDestroy() {
    window.removeEventListener('beforeinstallprompt', this.handler);
  }

  install() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then(() => {
        this.deferredPrompt = null;
        this.visible = false;
      });
    } else if (this.isIos()) {
      // Sur iOS, guider l'utilisateur
      alert('Pour installer :\n1. Appuyez sur le bouton Partager (carré avec flèche)\n2. Choisissez "Sur l\'écran d\'accueil"');
      this.visible = false;
    }
  }

  dismiss() {
    this.visible = false;
    sessionStorage.setItem('pwa-install-dismissed', '1');
  }

  private isIos(): boolean {
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  }

  private isInStandaloneMode(): boolean {
    return ('standalone' in window.navigator) && (window.navigator as any).standalone;
  }
}
