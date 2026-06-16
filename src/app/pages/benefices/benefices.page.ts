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
    const ctx = this.chartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.data.lignes.map(l => l.label),
        datasets: [{
          label: 'Bénéfice',
          data: this.data.lignes.map(l => l.benefice),
          backgroundColor: this.data.lignes.map(l => l.benefice >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)'),
          borderColor:      this.data.lignes.map(l => l.benefice >= 0 ? '#10b981' : '#ef4444'),
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  fmt(v: number): string { return this.beneficeService.formaterPrix(v); }

  get evolution(): number { return this.data?.evolution ?? 0; }
  get evolutionColor(): string {
    return this.evolution > 0 ? 'success' : this.evolution < 0 ? 'danger' : 'medium';
  }
  get evolutionIcon(): string {
    return this.evolution > 0 ? 'trending-up' : this.evolution < 0 ? 'trending-down' : 'remove';
  }
}
