import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { BoutiqueService } from '../services/boutique.service';
import { RapportService, StatistiquesGenerales } from '../services/rapport.service';
import { WebSocketService } from '../services/websocket.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnDestroy {
  stats?: StatistiquesGenerales;
  private wsSub?: Subscription;
  loading = false;
  boutiqueName = 'Boutique';
  today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  actions = [
    { title: 'Caisse', subtitle: 'Solde et opérations', icon: 'cash-outline', route: '/tabs/caisse' },
    { title: 'Ventes', subtitle: 'Historique', icon: 'receipt-outline', route: '/tabs/sales' },
    { title: 'Inventaire', subtitle: 'Entrées et sorties', icon: 'clipboard-outline', route: '/tabs/inventory' },
    { title: 'Produits', subtitle: 'Stock et prix', icon: 'cube-outline', route: '/tabs/products' },
    { title: 'Rapports', subtitle: 'Chiffres clés', icon: 'bar-chart-outline', route: '/tabs/reports' },
    { title: 'Nouvelle vente', subtitle: 'Panier mobile', icon: 'cart-outline', route: '/cart' },
    { title: 'Clients', subtitle: 'Fidélité et crédits', icon: 'people-outline', route: '/clients' },
    { title: 'Boutique', subtitle: 'Paramètres', icon: 'storefront-outline', route: '/boutique' },
    { title: 'Mobile Money', subtitle: 'Orange & Moov', icon: 'phone-portrait-outline', route: '/mobile-money' },
    // { title: 'Assistant IA', subtitle: 'Questions & Conseils', icon: 'sparkles-outline', route: '/assistant-ia' }, // désactivé temporairement
  ];

  constructor(
    public auth: AuthService,
    private boutique: BoutiqueService,
    private reports: RapportService,
    private router: Router,
    private ws: WebSocketService
  ) {}

  ionViewWillEnter(): void {
    this.boutiqueName = this.boutique.getInfo().nom;
    this.load();
    this.boutique.refreshBoutique().subscribe(info => this.boutiqueName = info.nom);
    // Refresh dashboard en temps réel
    this.wsSub = this.ws.subscribeTopic('/topic/dashboard').subscribe(() => {
      this.load();
    });
  }

  ionViewWillLeave(): void {
    this.wsSub?.unsubscribe();
    this.ws.unsubscribeTopic('/topic/dashboard');
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
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
  }

  go(route: string): void {
    this.router.navigateByUrl(route);
  }

  money(value?: number): string {
    return this.reports.formaterPrixFCFA(value || 0);
  }

}
