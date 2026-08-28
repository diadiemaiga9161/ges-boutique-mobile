import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MenuController, AlertController } from '@ionic/angular';
import { AuthService } from './services/auth.service';
import { WebSocketService } from './services/websocket.service';
import { NotificationService } from './services/notification.service';
import { BoutiqueConfigService } from './services/boutique-config.service';
import { BoutiqueService } from './services/boutique.service';
import { CommandeService } from './services/commande.service';
import { SyncService } from './services/sync.service';
import { AppUpdateService } from './services/app-update.service';
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

  // ==================== COMMANDES VITRINE EN ATTENTE ====================
  // Même principe que côté Angular (header-sidebar-large.component.ts) : le topic
  // WebSocket donne un popup quasi instantané si l'appli est déjà ouverte, et le
  // contrôle HTTP (ici au login) rattrape celles arrivées pendant une déconnexion.
  private wsSubCommandes?: Subscription;
  private commandesVitrineVues = new Set<number>();

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
    { title: 'Primes Vendeurs', icon: 'cash-outline', route: '/resources/objectifs-vendeur' },
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
    private boutiqueConfig: BoutiqueConfigService,
    private boutiqueService: BoutiqueService,
    private commandeService: CommandeService,
    private alertCtrl: AlertController,
    private syncService: SyncService,
    private appUpdateService: AppUpdateService,
  ) {}

  ngOnInit(): void {
    this.hideSplash();
    this.syncService.startAutoSync();
    // Détecte les nouvelles versions déployées et propose de recharger
    this.appUpdateService.init();

    if (environment.isCapacitor && !this.boutiqueConfig.isConfigured()) {
      this.router.navigateByUrl('/boutique-select', { replaceUrl: true });
    }

    this.authSub = this.auth.authenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.ws.connect();
        this.connecterCommandesVitrine();
      } else {
        this.ws.disconnect();
        this.wsSubCommandes?.unsubscribe();
        this.userPhoto = null;
      }
    });

    this.auth.currentUser$.subscribe(user => {
      this.userPhoto = user?.photo || null;
    });

    if (this.auth.isAuthenticated()) {
      this.ws.connect();
      this.userPhoto = this.auth.getPhoto();
      this.connecterCommandesVitrine();
    }
  }

  // ==================== COMMANDES VITRINE EN ATTENTE ====================

  private connecterCommandesVitrine(): void {
    const boutiqueId = this.boutiqueService.getInfo().id;
    if (boutiqueId) {
      this.wsSubCommandes = this.ws.subscribeTopic(`/topic/commandes/${boutiqueId}`)
        .subscribe(() => this.verifierCommandesVitrineEnAttente());
    }
    // Rattrape celles arrivées pendant qu'on n'était pas connecté (login/relance app).
    this.verifierCommandesVitrineEnAttente();
  }

  private verifierCommandesVitrineEnAttente(): void {
    this.commandeService.getVitrineEnAttente().subscribe({
      next: (commandes) => {
        const liste = commandes || [];
        const nouvelles = liste.filter(c => !this.commandesVitrineVues.has(c.id));
        if (nouvelles.length > 0) {
          nouvelles.forEach(c => this.commandesVitrineVues.add(c.id));
          this.afficherPopupCommandesVitrine(nouvelles, liste.length);
        }
      },
      error: () => { /* silencieux — pas encore connecté ou API indisponible */ }
    });
  }

  private async afficherPopupCommandesVitrine(nouvelles: any[], total: number): Promise<void> {
    const liste = nouvelles.map(c =>
      `<div style="text-align:left;margin-bottom:6px"><strong>${c.numeroCommande || ''}</strong> — ${c.clientNom || ''} ${c.clientPrenom || ''}</div>`
    ).join('');
    const alert = await this.alertCtrl.create({
      header: nouvelles.length > 1 ? `${nouvelles.length} nouvelles commandes en ligne !` : 'Nouvelle commande en ligne !',
      message: `${liste}<div style="margin-top:8px;font-size:.85rem;color:#64748b">${total} commande(s) en attente au total.</div>`,
      buttons: [
        { text: 'Plus tard', role: 'cancel' },
        { text: 'Voir', handler: () => this.router.navigateByUrl('/commandes') }
      ]
    });
    await alert.present();
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
    this.wsSubCommandes?.unsubscribe();
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
