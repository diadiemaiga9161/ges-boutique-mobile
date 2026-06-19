import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule, IonicModule],
  template: `
    <!-- Bannière install Android/Chrome -->
    <div class="pwa-banner" *ngIf="showBanner && !isIos()" (click)="$event.stopPropagation()">
      <div class="pwa-inner">
        <div class="pwa-icon">
          <img src="assets/icons/icon-72x72.png" alt="icon" />
        </div>
        <div class="pwa-text">
          <p class="pwa-title">Installer Ges Lafia</p>
          <p class="pwa-sub">Accès rapide depuis votre écran d'accueil</p>
        </div>
        <button class="pwa-btn-install" (click)="installAndroid()">Installer</button>
        <button class="pwa-btn-close" (click)="dismissBanner()" aria-label="Fermer">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </div>
    </div>

    <!-- Guide d'installation iOS -->
    <div class="ios-overlay" *ngIf="showIosGuide" (click)="dismissIosGuide()">
      <div class="ios-modal" (click)="$event.stopPropagation()">
        <button class="ios-close" (click)="dismissIosGuide()">
          <ion-icon name="close-outline"></ion-icon>
        </button>

        <div class="ios-header">
          <img src="assets/icons/icon-72x72.png" class="ios-app-icon" alt="Ges Lafia" />
          <h2 class="ios-title">Installer Ges Lafia</h2>
          <p class="ios-subtitle">Ajoutez l'app sur votre écran d'accueil</p>
        </div>

        <div class="ios-steps">
          <div class="ios-step">
            <div class="ios-step-num">1</div>
            <div class="ios-step-content">
              <p class="ios-step-label">Appuyez sur</p>
              <div class="ios-share-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                <span>Partager</span>
              </div>
              <p class="ios-step-hint">en bas de Safari</p>
            </div>
          </div>

          <div class="ios-divider"></div>

          <div class="ios-step">
            <div class="ios-step-num">2</div>
            <div class="ios-step-content">
              <p class="ios-step-label">Faites défiler et appuyez sur</p>
              <div class="ios-home-btn">
                <ion-icon name="add-outline" class="ios-add-icon"></ion-icon>
                <span>Sur l'écran d'accueil</span>
              </div>
            </div>
          </div>

          <div class="ios-divider"></div>

          <div class="ios-step">
            <div class="ios-step-num">3</div>
            <div class="ios-step-content">
              <p class="ios-step-label">Confirmez en appuyant sur</p>
              <span class="ios-ajouter">Ajouter</span>
              <p class="ios-step-hint">en haut à droite</p>
            </div>
          </div>
        </div>

        <div class="ios-tip">
          <ion-icon name="information-circle-outline"></ion-icon>
          <span>Fonctionne comme une app native, sans passer par l'App Store</span>
        </div>

        <div class="ios-arrow"></div>
      </div>
    </div>
  `,
  styles: [`
    /* ===== BANNIÈRE ANDROID ===== */
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
    .pwa-text { flex: 1; min-width: 0; }
    .pwa-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pwa-sub { font-size: 0.72rem; color: #64748b; margin: 0; }
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

    /* ===== GUIDE iOS ===== */
    .ios-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .ios-modal {
      background: #f2f2f7;
      border-radius: 22px 22px 0 0;
      padding: 20px 20px 40px;
      position: relative;
      animation: slideUpModal 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
    }
    @keyframes slideUpModal {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    .ios-close {
      position: absolute;
      top: 14px;
      right: 14px;
      background: rgba(120,120,128,0.16);
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      color: #636366;
      cursor: pointer;
    }
    .ios-header {
      text-align: center;
      margin-bottom: 24px;
    }
    .ios-app-icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      margin-bottom: 10px;
    }
    .ios-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: #1c1c1e;
      margin: 0 0 4px;
    }
    .ios-subtitle {
      font-size: 0.82rem;
      color: #636366;
      margin: 0;
    }
    .ios-steps {
      background: #ffffff;
      border-radius: 14px;
      padding: 6px 0;
      margin-bottom: 16px;
    }
    .ios-step {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 16px;
    }
    .ios-step-num {
      width: 26px;
      height: 26px;
      background: #1a56db;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .ios-step-content { flex: 1; }
    .ios-step-label {
      font-size: 0.82rem;
      color: #636366;
      margin: 0 0 6px;
    }
    .ios-step-hint {
      font-size: 0.75rem;
      color: #aeaeb2;
      margin: 4px 0 0;
    }
    .ios-share-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #e5f0ff;
      color: #1a56db;
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .ios-home-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #e5f0ff;
      color: #1a56db;
      border-radius: 8px;
      padding: 5px 10px;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .ios-add-icon { font-size: 1rem; }
    .ios-ajouter {
      display: inline-block;
      background: #e5f0ff;
      color: #1a56db;
      border-radius: 8px;
      padding: 5px 12px;
      font-size: 0.82rem;
      font-weight: 700;
    }
    .ios-divider {
      height: 1px;
      background: #f2f2f7;
      margin: 0 16px;
    }
    .ios-tip {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #e8f0fe;
      border-radius: 10px;
      padding: 10px 14px;
      font-size: 0.78rem;
      color: #1a56db;
    }
    .ios-tip ion-icon { font-size: 1.1rem; flex-shrink: 0; }
    .ios-arrow {
      width: 40px;
      height: 5px;
      background: rgba(0,0,0,0.15);
      border-radius: 3px;
      margin: 20px auto 0;
    }
  `]
})
export class PwaInstallComponent implements OnInit, OnDestroy {
  showBanner = false;
  showIosGuide = false;
  private deferredPrompt: any = null;

  private beforeInstallHandler = (e: any) => {
    e.preventDefault();
    this.deferredPrompt = e;
    if (!sessionStorage.getItem('pwa-banner-dismissed')) {
      this.showBanner = true;
    }
  };

  ngOnInit() {
    window.addEventListener('beforeinstallprompt', this.beforeInstallHandler);

    if (this.isIos() && !this.isInStandaloneMode()) {
      const lastShown = localStorage.getItem('pwa-ios-guide-shown');
      const now = Date.now();
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      if (!lastShown || now - parseInt(lastShown) > threeDays) {
        setTimeout(() => { this.showIosGuide = true; }, 2000);
      }
    }
  }

  ngOnDestroy() {
    window.removeEventListener('beforeinstallprompt', this.beforeInstallHandler);
  }

  installAndroid() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      this.deferredPrompt.userChoice.then(() => {
        this.deferredPrompt = null;
        this.showBanner = false;
      });
    }
  }

  dismissBanner() {
    this.showBanner = false;
    sessionStorage.setItem('pwa-banner-dismissed', '1');
  }

  dismissIosGuide() {
    this.showIosGuide = false;
    localStorage.setItem('pwa-ios-guide-shown', String(Date.now()));
  }

  isIos(): boolean {
    return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  }

  private isInStandaloneMode(): boolean {
    return ('standalone' in window.navigator) && (window.navigator as any).standalone;
  }
}
