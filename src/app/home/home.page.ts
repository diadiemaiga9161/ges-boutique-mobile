import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BoutiqueService } from '../services/boutique.service';
import { RapportService, StatistiquesGenerales } from '../services/rapport.service';
import { WebSocketService } from '../services/websocket.service';
import { IAService } from '../services/ia.service';
import { TransfertService } from '../services/transfert.service';
import { BeneficeService, BeneficeData } from '../services/benefice.service';
import { CaisseService } from '../services/caisse.service';
import { RoleService } from '../services/role.service';
import { VenteService } from '../services/vente.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {
  stats?: StatistiquesGenerales;
  beneficeJour?: BeneficeData;
  soldeCaisse?: { solde: number; soldeSysteme: number };
  /** Ventes d'aujourd'hui (GET /ventes/aujourdhui). stats.chiffreAffaire.totalVentes compte
   *  TOUTES les ventes depuis le début : l'accueil affichait « 23 ventes aujourd'hui » pour 0 FCFA. */
  nbVentesJour?: number;
  alertesStock: any[] = [];
  nbTransfertsEnAttente: number = 0;
  private wsSub?: Subscription;
  private wsTranSub?: Subscription;
  loading = false;
  boutiqueName = 'Boutique';
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  actions = [
    { title: 'Caisse', subtitle: 'Solde et opérations', icon: 'cash-outline', route: '/tabs/caisse' },
    { title: 'Inventaire', subtitle: 'Entrées et sorties', icon: 'clipboard-outline', route: '/tabs/inventory' },
    { title: 'Rapports', subtitle: 'Chiffres clés', icon: 'bar-chart-outline', route: '/tabs/reports' },
    { title: 'Commandes', subtitle: 'Bons de commande', icon: 'document-text-outline', route: '/commandes' },
    { title: 'Boutique', subtitle: 'Paramètres', icon: 'storefront-outline', route: '/boutique' },
    { title: 'Mobile Money', subtitle: 'Orange & Moov', icon: 'phone-portrait-outline', route: '/mobile-money' },
    // { title: 'Assistant IA', subtitle: 'Questions & Conseils', icon: 'sparkles-outline', route: '/assistant-ia' }, // désactivé temporairement
  ];

  constructor(
    public auth: AuthService,
    private boutique: BoutiqueService,
    private reports: RapportService,
    private router: Router,
    private ws: WebSocketService,
    private iaService: IAService,
    private transfertService: TransfertService,
    private beneficeService: BeneficeService,
    private caisseService: CaisseService,
    private venteService: VenteService,
    private roleService: RoleService
  ) {}

  ionViewWillEnter(): void {
    this.boutiqueName = this.boutique.getInfo().nom;
    this.load();
    this.boutique.refreshBoutique().subscribe(info => this.boutiqueName = info.nom);
    // Refresh dashboard en temps réel
    this.wsSub = this.ws.subscribeTopic('/topic/dashboard').subscribe(() => {
      this.load();
    });
    // Alertes rupture IA
    this.chargerAlertesIA();
    // Transferts en attente (HTTP initial)
    this.chargerTransfertsEnAttente();
    // Temps réel transferts via WebSocket
    const boutiqueId = this.boutique.getInfo().id;
    if (boutiqueId) {
      this.wsTranSub = this.ws.subscribeTopic(`/topic/transferts/${boutiqueId}`)
        .subscribe(() => this.chargerTransfertsEnAttente());
    }
  }

  ionViewWillLeave(): void {
    this.wsSub?.unsubscribe();
    this.ws.unsubscribeTopic('/topic/dashboard');
    this.wsTranSub?.unsubscribe();
    const boutiqueId = this.boutique.getInfo().id;
    if (boutiqueId) {
      this.ws.unsubscribeTopic(`/topic/transferts/${boutiqueId}`);
    }
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    this.wsTranSub?.unsubscribe();
  }

  private chargerAlertesIA(): void {
    this.iaService.getPrevisions().pipe(
      catchError(() => of([]))
    ).subscribe((previsions: any[]) => {
      this.alertesStock = previsions.filter(
        (p: any) => p.alerteRupture === true || p.ruptureImminente === true
      );
    });
  }

  private chargerTransfertsEnAttente(): void {
    this.transfertService.getRecus().pipe(
      catchError(() => of([]))
    ).subscribe(transferts => {
      this.nbTransfertsEnAttente = transferts.filter(
        t => t.statut === 'EN_ATTENTE_CONFIRMATION'
      ).length;
    });
  }

  private chargerBeneficeJour(): void {
    // Réservé au gérant (ou rôle basé sur Gérant avec « Finances ») : le serveur le refuse
    // aux autres, inutile de l'appeler.
    if (!this.auth.isAdmin() || !this.roleService.peut('FINANCES')) return;
    const dateJour = new Date().toISOString().split('T')[0];
    this.beneficeService.journalier(dateJour).pipe(
      catchError(() => of(undefined))
    ).subscribe(data => {
      this.beneficeJour = data;
    });
  }

  private chargerVentesJour(): void {
    this.venteService.getVentesDuJour().pipe(
      catchError(() => of(undefined))
    ).subscribe(res => {
      this.nbVentesJour = res ? res.ventes.length : undefined;
    });
  }

  private chargerSoldeCaisse(): void {
    if (!this.auth.isAdmin() || !this.roleService.peut('CAISSE')) return;
    this.caisseService.getSolde().pipe(
      catchError(() => of(undefined))
    ).subscribe(solde => {
      this.soldeCaisse = solde;
    });
  }

  load(event?: any): void {
    this.loading = true;
    this.reports.obtenirStatistiquesGenerales().subscribe({
      next: stats => {
        this.stats = stats;
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.loading = false;
        event?.target?.complete();
      }
    });
    this.chargerBeneficeJour();
    this.chargerSoldeCaisse();
    this.chargerVentesJour();
  }

  go(route: string): void {
    this.router.navigateByUrl(route);
  }

  money(value?: number): string {
    return this.reports.formaterPrixFCFA(value || 0);
  }

  count(value?: number): string {
    return String(value || 0);
  }

}
