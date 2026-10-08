import { Component, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Chart, registerables } from 'chart.js';
import {
  RapportHebdomadaire,
  RapportJournalier,
  RapportMensuel,
  RapportService,
  StatistiquesGenerales
} from '../../services/rapport.service';
import { CaisseService, CreditInfo, SituationCredits } from '../../services/caisse.service';
import { RapportWhatsappService } from '../../services/rapport-whatsapp.service';
import { AuthService } from '../../services/auth.service';

Chart.register(...registerables);

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false
})
export class ReportsPage implements OnDestroy {
  stats?: StatistiquesGenerales;
  daily?: RapportJournalier;
  weekly?: RapportHebdomadaire;
  monthly?: RapportMensuel;
  custom?: any;
  activeReport: 'day' | 'week' | 'month' | 'custom' | 'year' = 'day';
  selectedDate = this.reports.formaterDate(new Date());
  dateDebut = this.reports.formaterDate(new Date(Date.now() - 7 * 86400000));
  dateFin = this.reports.formaterDate(new Date());
  loading = false;
  trackById = (i: number, item: any) => item?.id ?? i;

  creditsEnCours: CreditInfo[] = [];
  situationCredits?: SituationCredits;

  // Analytique
  ca30Jours: Array<{date: string, ca: number}> = [];
  topProduits: Array<{produitNom: string, quantiteVendue: number, ca: number}> = [];
  ventesParHeure: Array<{heure: number, nbVentes: number}> = [];
  previsionStock: any[] = [];
  isLoadingAnalytics = false;
  maxCA = 1;
  maxQte = 1;
  maxVentes = 1;

  currentUser: any = null;

  @ViewChild('ca30Chart', { static: false }) ca30ChartRef!: ElementRef;
  private ca30Chart?: Chart;
  private analysesAccordionOuverte = false;

  constructor(
    public reports: RapportService,
    public caisseService: CaisseService,
    private toastCtrl: ToastController,
    private rapportWA: RapportWhatsappService,
    private authService: AuthService
  ) {}

  get isVendeur(): boolean { return this.authService.isVendeur(); }

  get currentYear(): number { return new Date().getFullYear(); }

  ionViewWillEnter(): void {
    this.currentUser = this.authService.getUser();
    this.load();
    this.loadCredits();
    this.chargerAnalytics();
  }

  load(event?: any): void {
    this.reports.obtenirStatistiquesGenerales().subscribe({
      next: stats => {
        this.stats = stats;
        event?.target?.complete();
      },
      error: error => {
        event?.target?.complete();
        this.presentToast(error.message || 'Statistiques indisponibles', 'danger');
      }
    });
    this.loadDaily();
  }

  loadCredits(): void {
    this.caisseService.getCreditsNonRegles().subscribe(credits => this.creditsEnCours = credits);
    this.caisseService.getSituationCredits().subscribe(s => this.situationCredits = s);
  }

  loadDaily(event?: any): void {
    this.loading = true;
    this.reports.genererRapportJournalier(this.selectedDate).subscribe({
      next: report => {
        this.daily = report;
        this.loading = false;
        event?.target?.complete();
      },
      error: error => {
        this.loading = false;
        event?.target?.complete();
        this.presentToast(error.message || 'Rapport journalier indisponible', 'danger');
      }
    });
  }

  loadWeekly(): void {
    this.loading = true;
    this.reports.genererRapportHebdomadaire().subscribe({
      next: report => {
        this.weekly = report;
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.presentToast(error.message || 'Rapport hebdomadaire indisponible', 'danger');
      }
    });
  }

  loadMonthly(): void {
    this.loading = true;
    this.reports.genererRapportMensuel().subscribe({
      next: report => {
        this.monthly = report;
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.presentToast(error.message || 'Rapport mensuel indisponible', 'danger');
      }
    });
  }

  loadCustom(): void {
    if (!this.dateDebut || !this.dateFin) {
      this.presentToast('Sélectionnez une période', 'danger');
      return;
    }
    this.loading = true;
    this.reports.genererRapportPeriodique(this.dateDebut, this.dateFin).subscribe({
      next: report => {
        this.custom = report;
        this.loading = false;
      },
      error: error => {
        this.loading = false;
        this.presentToast(error.message || 'Rapport personnalisé indisponible', 'danger');
      }
    });
  }

  // "Annuel" : 1er janvier au 31 décembre de l'année en cours, puis réutilise EXACTEMENT
  // le même mécanisme que "Personnalisé" (mêmes dateDebut/dateFin, même loadCustom()) —
  // aucun nouvel appel/calcul spécifique, seules les dates sont auto-calculées ici.
  loadYearly(): void {
    const annee = this.currentYear;
    this.dateDebut = this.reports.formaterDate(new Date(annee, 0, 1));
    this.dateFin = this.reports.formaterDate(new Date(annee, 11, 31));
    this.loadCustom();
  }

  switchReport(type: 'day' | 'week' | 'month' | 'custom' | 'year'): void {
    this.activeReport = type;
    if (type === 'day' && !this.daily) this.loadDaily();
    if (type === 'week' && !this.weekly) this.loadWeekly();
    if (type === 'month' && !this.monthly) this.loadMonthly();
    if (type === 'year') this.loadYearly();
  }

  refresh(): void {
    if (this.activeReport === 'day') { this.daily = undefined; this.loadDaily(); }
    if (this.activeReport === 'week') { this.weekly = undefined; this.loadWeekly(); }
    if (this.activeReport === 'month') { this.monthly = undefined; this.loadMonthly(); }
    if (this.activeReport === 'custom') { this.custom = undefined; this.loadCustom(); }
    if (this.activeReport === 'year') { this.custom = undefined; this.loadYearly(); }
  }

  exportDaily(): void {
    if (!this.daily) return;
    this.reports.exporterRapportPDF(this.selectedDate, this.selectedDate, `Rapport du ${this.reports.formatDateShort(this.selectedDate)}`);
    this.presentToast('Export PDF lancé');
  }

  exportWeekly(): void {
    if (!this.weekly) return;
    const titre = `Rapport semaine du ${this.reports.formatDateShort(this.weekly.debutSemaine)} au ${this.reports.formatDateShort(this.weekly.finSemaine)}`;
    this.reports.exporterRapportPDF(this.weekly.debutSemaine, this.weekly.finSemaine, titre);
    this.presentToast('Export PDF lancé');
  }

  exportMonthly(): void {
    if (!this.monthly) return;
    this.reports.exporterRapportPDF(this.monthly.dateDebut, this.monthly.dateFin, `Rapport ${this.monthly.mois} ${this.monthly.annee}`);
    this.presentToast('Export PDF lancé');
  }

  exportCustom(): void {
    if (!this.custom) return;
    const titre = this.activeReport === 'year' ? `Rapport annuel ${this.currentYear}` : 'Rapport personnalisé';
    this.reports.exporterRapportPDF(this.dateDebut, this.dateFin, titre);
    this.presentToast('Export PDF lancé');
  }

  getTopProduits(): Array<{ nom: string; quantite: number; quantiteTexte?: string; chiffreAffaire: number }> {
    const rapport = this.getActiveReport();
    if (rapport?.topProduits) return rapport.topProduits.slice(0, 5);
    if (this.stats?.produitsPlusVendus) {
      return this.stats.produitsPlusVendus.slice(0, 5).map(p => ({
        nom: p.nom,
        quantite: p.quantiteVendue,
        quantiteTexte: p.quantiteTexte,
        chiffreAffaire: p.chiffreAffaire
      }));
    }
    return [];
  }

  getTopProduitsGeneraux(): Array<{ nom: string; quantite: number; quantiteTexte?: string; chiffreAffaire: number }> {
    if (!this.stats?.produitsPlusVendus) return [];
    return this.stats.produitsPlusVendus.slice(0, 5).map(p => ({
      nom: p.nom,
      quantite: p.quantiteVendue,
      quantiteTexte: p.quantiteTexte,
      chiffreAffaire: p.chiffreAffaire
    }));
  }

  getModePaiementStats(): Array<{ mode: string; montant: number; pourcentage: number }> {
    const rapport = this.getActiveReport();
    return rapport?.modePaiementStats || this.stats?.modePaiementStats || [];
  }

  getActiveReport(): any {
    if (this.activeReport === 'day') return this.daily;
    if (this.activeReport === 'week') return this.weekly;
    if (this.activeReport === 'month') return this.monthly;
    return this.custom;
  }

  getCA(): number {
    const r = this.getActiveReport();
    return r?.chiffreAffaireTotal || r?.chiffreAffaire || r?.resume?.chiffreAffaireTotal || 0;
  }

  getBenefice(): number {
    const r = this.getActiveReport();
    return r?.beneficeTotal || r?.benefice || r?.resume?.beneficeTotal || 0;
  }

  getNombreVentes(): number {
    const r = this.getActiveReport();
    return r?.nombreVentes || r?.nombreVentesTotales || r?.resume?.nombreVentes || 0;
  }

  money(value: number): string {
    return this.reports.formaterPrixFCFA(value || 0);
  }

  getModePaiementLabel(mode: string): string {
    return this.reports.getModePaiementLabel(mode);
  }

  onExport(fn: string): void {
    if (fn === 'exportDaily')  this.exportDaily();
    if (fn === 'exportWeekly') this.exportWeekly();
    if (fn === 'exportMonthly') this.exportMonthly();
    if (fn === 'exportCustom') this.exportCustom();
  }

  getPaymentIcon(mode: string): string {
    const icons: Record<string, string> = {
      ESPECES:        'cash-outline',
      ORANGE_MONEY:   'phone-portrait-outline',
      MOOV_MONEY:     'phone-portrait-outline',
      CARTE_BANCAIRE: 'card-outline',
      VIREMENT:       'swap-horizontal-outline',
    };
    return icons[mode] ?? 'wallet-outline';
  }

  envoyerWhatsAppJour(): void {
    if (!this.daily) { this.presentToast('Rapport journalier non chargé', 'danger'); return; }
    this.rapportWA.envoyerRapportJour(this.daily);
  }

  envoyerWhatsAppSemaine(): void {
    if (!this.weekly) { this.presentToast('Rapport hebdomadaire non chargé', 'danger'); return; }
    this.rapportWA.envoyerRapportSemaine(this.weekly);
  }

  envoyerWhatsAppMois(): void {
    if (!this.monthly) { this.presentToast('Rapport mensuel non chargé', 'danger'); return; }
    this.rapportWA.envoyerRapportMois(this.monthly);
  }

  chargerAnalytics(): void {
    this.isLoadingAnalytics = true;
    this.reports.getCA30Jours().subscribe({
      next: d => {
        this.ca30Jours = d;
        this.maxCA = Math.max(...d.map((x: any) => x.ca), 1);
        setTimeout(() => this.dessinerCA30Chart(), 200);
      },
      error: () => {}
    });
    this.reports.getTopProduits().subscribe({
      next: d => { this.topProduits = d; this.maxQte = Math.max(...d.map((x: any) => x.quantiteVendue), 1); },
      error: () => {}
    });
    this.reports.getVentesParHeure().subscribe({
      next: d => { this.ventesParHeure = d; this.maxVentes = Math.max(...d.map((x: any) => x.nbVentes), 1); this.isLoadingAnalytics = false; },
      error: () => { this.isLoadingAnalytics = false; }
    });
    this.reports.getPrevisionStock().subscribe({
      next: d => this.previsionStock = d,
      error: () => {}
    });
  }

  pct(val: number, max: number): number {
    return max > 0 ? Math.round((val / max) * 100) : 0;
  }

  // L'accordéon "Analyses visuelles" est replié par défaut : le <canvas> du graphique
  // CA 30 jours n'existe pas encore dans le DOM tant qu'il n'a pas été ouvert au moins
  // une fois, donc getContext('2d') échouerait si on dessinait au chargement des données.
  // On (re)dessine donc aussi à l'ouverture de l'accordéon "analyses".
  onAccordionChange(event: any): void {
    const valeurs = event?.detail?.value;
    const estOuverte = Array.isArray(valeurs) ? valeurs.includes('analyses') : valeurs === 'analyses';
    if (estOuverte && !this.analysesAccordionOuverte) {
      this.analysesAccordionOuverte = true;
      // Délai > durée de l'animation d'ouverture de l'accordéon (~300ms) pour mesurer
      // la taille définitive du conteneur, pas une taille intermédiaire de l'animation.
      setTimeout(() => this.dessinerCA30Chart(), 350);
    }
  }

  private dessinerCA30Chart(): void {
    if (!this.ca30Jours?.length || !this.ca30ChartRef) return;
    this.ca30Chart?.destroy();
    const canvas = this.ca30ChartRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // responsive:true (ResizeObserver interne à Chart.js) boucle à l'infini et gèle
    // l'onglet quand le canvas est dans un conteneur qui anime sa propre taille à
    // l'ouverture (ion-accordion) : chaque redraw déclenche une nouvelle détection de
    // redimensionnement pendant l'animation, qui redéclenche un redraw, etc. On fixe
    // donc la taille du canvas nous-mêmes (dimensions natives, pas juste CSS) une
    // seule fois et on désactive complètement le suivi automatique de Chart.js.
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(rect.width, 1) * dpr;
    canvas.height = Math.max(rect.height, 1) * dpr;
    ctx.scale(dpr, dpr);

    // Couleurs lues depuis les tokens --gl-* au moment du dessin : correctes en
    // clair, sombre Auto ET sombre forcé (body.theme-dark), contrairement à
    // l'ancien test prefers-color-scheme. Données et calculs inchangés.
    const css = getComputedStyle(document.body);
    const token = (nom: string, repli: string) => css.getPropertyValue(nom).trim() || repli;
    const tickColor = token('--gl-muted', '#64748b');
    const gridColor = token('--gl-border', '#e2e8f0');
    const barColor = token('--gl-action', '#1a56db');

    this.ca30Chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.ca30Jours.map(d => d.date),
        datasets: [{
          label: 'CA',
          data: this.ca30Jours.map(d => d.ca),
          backgroundColor: barColor,
          borderColor: barColor,
          borderWidth: 0,
          borderRadius: 2
        }]
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor, maxRotation: 0, autoSkip: true }, grid: { color: gridColor } }
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.ca30Chart?.destroy();
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
