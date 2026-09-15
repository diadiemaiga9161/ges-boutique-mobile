import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Chart, registerables } from 'chart.js';
import { Subscription } from 'rxjs';
import { BeneficeService, BeneficeData } from '../../services/benefice.service';

Chart.register(...registerables);

type Periode = 'JOURNALIER' | 'HEBDOMADAIRE' | 'MENSUEL' | 'ANNUEL';

@Component({
  selector: 'app-benefices',
  templateUrl: './benefices.page.html',
  styleUrls: ['./benefices.page.scss'],
  standalone: false
})
export class BeneficesPage implements OnInit, OnDestroy {

  periodeActive: Periode = 'JOURNALIER';
  isLoading = false;
  data: BeneficeData | null = null;

  today = new Date().toISOString().split('T')[0];
  dateJour = new Date().toISOString().split('T')[0];
  moisSelect = new Date().getMonth() + 1;
  anneeSelect = new Date().getFullYear();
  annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  moisList = [
    { v: 1, l: 'Janvier' }, { v: 2, l: 'Février' }, { v: 3, l: 'Mars' },
    { v: 4, l: 'Avril' },   { v: 5, l: 'Mai' },     { v: 6, l: 'Juin' },
    { v: 7, l: 'Juillet' }, { v: 8, l: 'Août' },    { v: 9, l: 'Septembre' },
    { v: 10, l: 'Octobre'}, { v: 11, l: 'Novembre'},{ v: 12, l: 'Décembre' }
  ];

  @ViewChild('beneficeChart', { static: false }) chartRef!: ElementRef;
  private chart: Chart | undefined;
  private subs: Subscription[] = [];

  constructor(
    private beneficeService: BeneficeService,
    private toast: ToastController
  ) {}

  ngOnInit(): void { this.charger(); }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.chart?.destroy();
  }

  ionViewWillEnter(): void { this.charger(); }

  selectionner(p: Periode): void {
    this.periodeActive = p;
    this.charger();
  }

  charger(): void {
    this.isLoading = true;
    this.chart?.destroy();

    let obs$;
    switch (this.periodeActive) {
      case 'JOURNALIER':   obs$ = this.beneficeService.journalier(this.dateJour); break;
      case 'HEBDOMADAIRE': obs$ = this.beneficeService.hebdomadaire(); break;
      case 'MENSUEL':      obs$ = this.beneficeService.mensuel(this.moisSelect, this.anneeSelect); break;
      case 'ANNUEL':       obs$ = this.beneficeService.annuel(this.anneeSelect); break;
    }

    const sub = obs$.subscribe({
      next: (d) => {
        this.data = d;
        this.isLoading = false;
        setTimeout(() => this.dessinerChart(), 200);
      },
      error: async (e) => {
        this.isLoading = false;
        const t = await this.toast.create({ message: e.message, duration: 3000, color: 'danger', position: 'top' });
        await t.present();
      }
    });
    this.subs.push(sub);
  }

  async exporterPDF(): Promise<void> {
    if (!this.data) return;
    try {
      this.beneficeService.exporterPDF(this.data);
      const t = await this.toast.create({ message: 'PDF généré avec succès !', duration: 2000, color: 'success', position: 'top' });
      await t.present();
    } catch {
      const t = await this.toast.create({ message: 'Erreur lors de la génération PDF', duration: 3000, color: 'danger', position: 'top' });
      await t.present();
    }
  }

  private dessinerChart(): void {
    if (!this.data?.lignes?.length || !this.chartRef) return;
    this.chart?.destroy();
    const canvas = this.chartRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // responsive:true (ResizeObserver interne à Chart.js) peut entrer en boucle infinie
    // et geler l'onglet quand le canvas est dans un conteneur dont la hauteur dépend du
    // breakpoint (.chart-wrap ici : 220/280/340px selon la largeur) — même bug identifié
    // et corrigé sur reports.page.ts (accordéon qui anime sa taille à l'ouverture). On
    // fixe donc la taille du canvas nous-mêmes (dimensions natives, pas juste CSS) une
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
    const okColor = token('--gl-ok', '#047857');
    const badColor = token('--gl-bad', '#dc2626');

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.data.lignes.map(l => l.label),
        datasets: [{
          label: 'Bénéfice',
          data: this.data.lignes.map(l => l.benefice),
          backgroundColor: this.data.lignes.map(l => l.benefice >= 0 ? okColor : badColor),
          borderColor:      this.data.lignes.map(l => l.benefice >= 0 ? okColor : badColor),
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        responsive: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { color: tickColor }, grid: { color: gridColor } },
          x: { ticks: { color: tickColor }, grid: { color: gridColor } }
        }
      }
    });
  }

  trackById = (_: number, item: any) => item.id;

  fmt(v: number): string { return this.beneficeService.formaterPrix(v); }

  get evolution(): number { return this.data?.evolution ?? 0; }
  get evolutionColor(): string {
    return this.evolution > 0 ? 'success' : this.evolution < 0 ? 'danger' : 'medium';
  }
  get evolutionIcon(): string {
    return this.evolution > 0 ? 'trending-up' : this.evolution < 0 ? 'trending-down' : 'remove';
  }
}
