import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController } from '@ionic/angular';
import { AuthService } from './services/auth.service';
import { WebSocketService } from './services/websocket.service';
import { NotificationService } from './services/notification.service';
import { BoutiqueConfigService } from './services/boutique-config.service';
import { environment } from '../environments/environment';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private authSub?: Subscription;
  userPhoto: string | null = null;

  menuPages = [
    { title: 'Tableau de bord', icon: 'home-outline', route: '/home' },
    { title: 'Clients', icon: 'people-outline', route: '/clients' },
    { title: 'Nouvelle vente', icon: 'cart-outline', route: '/cart' },
    { title: 'Factures', icon: 'document-text-outline', route: '/resources/factures' },
    { title: 'Comptes bancaires', icon: 'card-outline', route: '/resources/comptes' },
    { title: 'Dettes', icon: 'alert-circle-outline', route: '/resources/dettes' },
    { title: 'Employés', icon: 'person-add-outline', route: '/resources/employes' },
    { title: 'Paiements employés', icon: 'wallet-outline', route: '/resources/paiement-employe' },
    { title: 'Objectifs Fournisseurs', icon: 'trophy-outline', route: '/resources/objectifs-fournisseur' },
    { title: 'Crédits clients', icon: 'time-outline', route: '/credits' },
    { title: 'Fournisseurs', icon: 'business-outline', route: '/fournisseurs' },
    { title: 'Dépôts Garde', icon: 'lock-closed-outline', route: '/depots' },
    { title: 'Vendeurs', icon: 'people-circle-outline', route: '/resources/vendeurs' },
    { title: 'Boutique', icon: 'storefront-outline', route: '/boutique' },
    { title: 'Mon profil', icon: 'person-circle-outline', route: '/profile' },
  ];

  constructor(
    private router: Router,
    private menu: MenuController,
    public auth: AuthService,
    public ws: WebSocketService,
    public notifService: NotificationService,
    private boutiqueConfig: BoutiqueConfigService
  ) {}

  ngOnInit(): void {
    this.hideSplash();

    if (environment.isCapacitor && !this.boutiqueConfig.isConfigured()) {
      this.router.navigateByUrl('/boutique-select', { replaceUrl: true });
    }

    this.authSub = this.auth.authenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.ws.connect();
      } else {
        this.ws.disconnect();
        this.userPhoto = null;
      }
    });

    this.auth.currentUser$.subscribe(user => {
      this.userPhoto = user?.photo || null;
    });

    if (this.auth.isAuthenticated()) {
      this.ws.connect();
      this.userPhoto = this.auth.getPhoto();
    }
  }

  private hideSplash(): void {
    const el = document.getElementById('app-splash');
    if (el) {
      el.classList.add('hidden');
      setTimeout(() => el.remove(), 520);
    }
    if (environment.isCapacitor) {
      import('@capacitor/splash-screen').then(({ SplashScreen }) => {
        SplashScreen.hide({ fadeOutDuration: 400 });
      }).catch(() => {});
    }
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    this.ws.disconnect();
  }

  navigate(route: string): void {
    this.menu.close('main-menu');
    this.router.navigateByUrl(route);
  }

  logout(): void {
    this.menu.close('main-menu');
    this.auth.signout();
  }

  getUserName(): string {
    return this.auth.getDisplayName() || 'Utilisateur';
  }

  getRole(): string {
    return this.auth.getFormattedRole() || '';
  }
}
