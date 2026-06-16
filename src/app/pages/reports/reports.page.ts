import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import {
  RapportHebdomadaire,
  RapportJournalier,
  RapportMensuel,
  RapportService,
  StatistiquesGenerales
} from '../../services/rapport.service';
import { CaisseService, CreditInfo, SituationCredits } from '../../services/caisse.service';

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: false
})
export class ReportsPage {
  stats?: StatistiquesGenerales;
  daily?: RapportJournalier;
  weekly?: RapportHebdomadaire;
  monthly?: RapportMensuel;
  custom?: any;
  activeReport: 'day' | 'week' | 'month' | 'custom' = 'day';
  selectedDate = this.reports.formaterDate(new Date());
  dateDebut = this.reports.formaterDate(new Date(Date.now() - 7 * 86400000));
  dateFin = this.reports.formaterDate(new Date());
  loading = false;

  creditsEnCours: CreditInfo[] = [];
  situationCredits?: SituationCredits;

  constructor(
    public reports: RapportService,
    public caisseService: CaisseService,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.load();
    this.loadCredits();
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

  switchReport(type: 'day' | 'week' | 'month' | 'custom'): void {
    this.activeReport = type;
    if (type === 'day' && !this.daily) this.loadDaily();
    if (type === 'week' && !this.weekly) this.loadWeekly();
    if (type === 'month' && !this.monthly) this.loadMonthly();
  }

  refresh(): void {
    if (this.activeReport === 'day') { this.daily = undefined; this.loadDaily(); }
    if (this.activeReport === 'week') { this.weekly = undefined; this.loadWeekly(); }
    if (this.activeReport === 'month') { this.monthly = undefined; this.loadMonthly(); }
    if (this.activeReport === 'custom') { this.custom = undefined; this.loadCustom(); }
  }

  exportDaily(): void {
    if (!this.daily) return;
    this.reports.exporterRapportPDF(this.daily, 'journalier');
    this.presentToast('Export PDF lancé');
  }

  exportWeekly(): void {
    if (!this.weekly) return;
    this.reports.exporterRapportPDF(this.weekly, 'hebdomadaire');
    this.presentToast('Export PDF lancé');
  }

  exportMonthly(): void {
    if (!this.monthly) return;
    this.reports.exporterRapportPDF(this.monthly, 'mensuel');
    this.presentToast('Export PDF lancé');
  }

  exportCustom(): void {
    if (!this.custom) return;
    this.reports.exporterRapportPDF(this.custom, 'personnalise');
    this.presentToast('Export PDF lancé');
  }

  getTopProduits(): Array<{ nom: string; quantite: number; chiffreAffaire: number }> {
    const rapport = this.getActiveReport();
    if (rapport?.topProduits) return rapport.topProduits.slice(0, 5);
    if (this.stats?.produitsPlusVendus) {
      return this.stats.produitsPlusVendus.slice(0, 5).map(p => ({
        nom: p.nom,
        quantite: p.quantiteVendue,
        chiffreAffaire: p.chiffreAffaire
      }));
    }
    return [];
  }

  getTopProduitsGeneraux(): Array<{ nom: string; quantite: number; chiffreAffaire: number }> {
    if (!this.stats?.produitsPlusVendus) return [];
    return this.stats.produitsPlusVendus.slice(0, 5).map(p => ({
      nom: p.nom,
      quantite: p.quantiteVendue,
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

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
