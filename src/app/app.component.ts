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
import { ThemeService } from './services/theme.service';
import { environment } from '../environments/environment';
import { Subscription } from 'rxjs';
import { MENU_SECTIONS, MenuSection } from './config/menu-items.config';
import { canShowMenuItem, MenuVisibilityContext } from './config/menu-visibility.util';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  private authSub?: Subscription;
  userPhoto: string | null = null;
  /** Nom de la boutique affiché sous « Ges Lafia » dans le menu (≡ DrawerContent RN,
   *  qui affiche boutiqueNom avec « Maïga Consulting » en secours). */
  boutiqueNom: string | null = null;

  // ==================== COMMANDES VITRINE EN ATTENTE ====================
  // Même principe que côté Angular (header-sidebar-large.component.ts) : le topic
  // WebSocket donne un popup quasi instantané si l'appli est déjà ouverte, et le
  // contrôle HTTP (ici au login) rattrape celles arrivées pendant une déconnexion.
  private wsSubCommandes?: Subscription;
  private commandesVitrineVues = new Set<number>();

  // Fonctionnalité désactivable par le super admin (Boutique > Paramètres) —
  // masque l'entrée du menu ; le vrai blocage est fait côté serveur.
  featureTransfertsActif = true;

  // Fonctionnalités avancées (système séparé) — clés désactivées par le super admin,
  // pour masquer les entrées de menu correspondantes (voir app.component.html).
  fonctionnalitesDesactivees = new Set<string>();

  // Permission vendeur "Inventaire en lecture seule" (système générique séparé —
  // décision d'un ADMIN NORMAL, pas besoin de super admin — voir boutique.service.ts).
  // Ne pas mélanger avec fonctionnalitesDesactivees ci-dessus.
  permissionInventaireLectureActive = false;

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
    private themeService: ThemeService,
  ) {}

  ngOnInit(): void {
    // Applique dès le démarrage le thème choisi dans le Profil (Clair / Sombre / Auto).
    // Sans cet appel, le choix n'était relu qu'en ouvrant la page Profil : un mode
    // sombre forcé repassait en automatique à chaque lancement de l'appli.
    this.themeService.init();
    this.hideSplash();
    this.syncService.startAutoSync();
    // Détecte les nouvelles versions déployées et propose de recharger
    this.appUpdateService.init();
    this.boutiqueService.info$.subscribe(info => {
      this.featureTransfertsActif = info.featureTransfertsActif !== false;
      this.boutiqueNom = info?.nom || null;
    });
    this.boutiqueService.fonctionnalitesAvancees$.subscribe(liste => {
      this.fonctionnalitesDesactivees = new Set(liste.filter(f => !f.actif).map(f => f.cle));
    });
    this.boutiqueService.permissionsVendeur$.subscribe(liste => {
      this.permissionInventaireLectureActive = liste.find(p => p.cle === 'INVENTAIRE_LECTURE')?.actif === true;
    });

    if (environment.isCapacitor && !this.boutiqueConfig.isConfigured()) {
      this.router.navigateByUrl('/boutique-select', { replaceUrl: true });
    }

    this.authSub = this.auth.authenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.ws.connect();
        this.connecterCommandesVitrine();
        this.boutiqueService.chargerFonctionnalitesAvancees().subscribe();
        this.boutiqueService.chargerPermissionsVendeur().subscribe();
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
      // Rafraîchit le profil stocké localement depuis le serveur au démarrage — une
      // session ouverte AVANT l'ajout d'un champ (ex: superAdmin) gardait sinon un
      // objet utilisateur incomplet en cache indéfiniment, sans jamais redemander de
      // reconnexion à l'utilisateur.
      this.auth.getCurrentProfile().subscribe({ error: () => {} });
      this.boutiqueService.chargerFonctionnalitesAvancees().subscribe();
      this.boutiqueService.chargerPermissionsVendeur().subscribe();
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

  /**
   * Important : `message` doit rester du texte brut, jamais du HTML — Ionic n'interprète
   * pas le HTML dans AlertController.message par défaut (innerHTMLTemplatesEnabled=false),
   * donc des balises passées ici s'affichaient littéralement à l'écran au lieu d'être
   * rendues (même piège déjà documenté dans cart.page.ts/presentSaleSuccess). Les sauts
   * de ligne sont rendus grâce à `white-space: pre-line` sur .commande-vitrine-alert
   * (voir global.scss), pas via des balises <div>.
   */
  private async afficherPopupCommandesVitrine(nouvelles: any[], total: number): Promise<void> {
    const liste = nouvelles.map(c =>
      `${c.numeroCommande || ''} — ${c.clientNom || ''} ${c.clientPrenom || ''}`.trim()
    ).join('\n');
    const alert = await this.alertCtrl.create({
      cssClass: 'commande-vitrine-alert',
      header: nouvelles.length > 1 ? `${nouvelles.length} nouvelles commandes en ligne !` : 'Nouvelle commande en ligne !',
      message: `${liste}\n\n${total} commande(s) en attente au total.`,
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

  /** Sections du tiroir latéral déjà filtrées par permission/flag (canShowMenuItem),
   *  sections devenues vides retirées entièrement (ex: "Transferts" quand
   *  featureTransfertsActif=false) — voir app.component.html. */
  get visibleMenuSections(): MenuSection[] {
    const ctx: MenuVisibilityContext = {
      isAdmin: this.auth.isAdmin(),
      isSuperAdmin: this.auth.isSuperAdmin(),
      fonctionnalitesDesactivees: this.fonctionnalitesDesactivees,
      permissionInventaireLectureActive: this.permissionInventaireLectureActive,
      featureTransfertsActif: this.featureTransfertsActif,
    };
    return MENU_SECTIONS
      .map(section => ({ ...section, items: section.items.filter(item => canShowMenuItem(item, ctx)) }))
      .filter(section => section.items.length > 0);
  }

  // Identité stable des sections / entrées du menu (voir app.component.html) :
  // évite de recréer les lignes à chaque détection de changements.
  trackMenuSection(index: number, section: MenuSection): string {
    return section.labelKey || `section-${index}`;
  }

  trackMenuItem(_index: number, item: { route: string }): string {
    return item.route;
  }
}
