import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { IAService, AnalyseIAResult, RecommandationIA, ProfilIA } from '../../services/ia.service';
import { catchError, of } from 'rxjs';

interface RecoAvecEtat extends RecommandationIA {
  traitee?: boolean;
  etatFeedback?: 'SUIVIE' | 'IGNOREE';
}

@Component({
  selector: 'app-ia',
  templateUrl: './ia.page.html',
  styleUrls: ['./ia.page.scss'],
  standalone: false
})
export class IaPage {

  // ── Onglet actif ───────────────────────────────
  activeTab: 'dashboard' | 'recommandations' | 'clients' | 'chat' = 'dashboard';

  // ── Données analyse ────────────────────────────
  analyse: AnalyseIAResult | null = null;
  recommandations: RecoAvecEtat[] = [];
  loading = false;
  analyseErreur = false;

  // ── Wizard profil ──────────────────────────────
  showWizard = false;
  wizardStep = 1;
  profil: ProfilIA = {
    typeBoutique: '',
    joursApprovisionnement: [],
    objectifStockJours: 14,
    margeObjectif: 20,
    delaiReglementCredit: 15
  };
  wizardLoading = false;
  profilVerifie = false;

  // ── Options wizard ─────────────────────────────
  readonly typesBoutique = [
    { value: 'ALIMENTATION', labelKey: 'IA.BOUTIQUE_TYPE_ALIM', icon: 'basket-outline' },
    { value: 'TEXTILE', labelKey: 'IA.BOUTIQUE_TYPE_TEXTILE', icon: 'shirt-outline' },
    { value: 'ELECTRONIQUE', labelKey: 'IA.BOUTIQUE_TYPE_ELEC', icon: 'phone-portrait-outline' },
    { value: 'PHARMACIE', labelKey: 'IA.BOUTIQUE_TYPE_PHARMA', icon: 'medical-outline' },
    { value: 'MIXTE', labelKey: 'IA.BOUTIQUE_TYPE_MIXTE', icon: 'grid-outline' },
    { value: 'AUTRE', labelKey: 'IA.BOUTIQUE_TYPE_AUTRE', icon: 'storefront-outline' }
  ];

  readonly joursOptions = [
    { value: 'LUNDI', labelKey: 'IA.DAY_MON' },
    { value: 'MARDI', labelKey: 'IA.DAY_TUE' },
    { value: 'MERCREDI', labelKey: 'IA.DAY_WED' },
    { value: 'JEUDI', labelKey: 'IA.DAY_THU' },
    { value: 'VENDREDI', labelKey: 'IA.DAY_FRI' },
    { value: 'SAMEDI', labelKey: 'IA.DAY_SAT' }
  ];

  readonly stockOptions = [7, 14, 21, 30, 45, 60];
  readonly margeOptions = [10, 15, 20, 25, 30, 40, 50];
  readonly delaiOptions = [7, 15, 30, 45, 60];

  // ── Segments clients ───────────────────────────
  readonly segmentsMeta: { key: string; labelKey: string; desc: string; cssClass: string; icon: string }[] = [
    { key: 'CHAMPIONS',  labelKey: 'IA.SEGMENT_CHAMPIONS', desc: 'IA.SEGMENT_CHAMPIONS_DESC', cssClass: 'seg-gold',    icon: 'trophy-outline' },
    { key: 'LOYAUX',     labelKey: 'IA.SEGMENT_LOYAUX',    desc: 'IA.SEGMENT_LOYAUX_DESC',    cssClass: 'seg-green',   icon: 'heart-outline' },
    { key: 'POTENTIELS', labelKey: 'IA.SEGMENT_POTENTIELS',desc: 'IA.SEGMENT_POTENTIELS_DESC',cssClass: 'seg-blue',   icon: 'trending-up-outline' },
    { key: 'A_RISQUE',   labelKey: 'IA.SEGMENT_A_RISQUE',  desc: 'IA.SEGMENT_A_RISQUE_DESC',  cssClass: 'seg-orange', icon: 'warning-outline' },
    { key: 'ENDORMIS',   labelKey: 'IA.SEGMENT_ENDORMIS',  desc: 'IA.SEGMENT_ENDORMIS_DESC',  cssClass: 'seg-red',    icon: 'moon-outline' },
    { key: 'NOUVEAUX',   labelKey: 'IA.SEGMENT_NOUVEAUX',  desc: 'IA.SEGMENT_NOUVEAUX_DESC',  cssClass: 'seg-purple', icon: 'sparkles-outline' }
  ];

  constructor(
    private iaService: IAService,
    private toastCtrl: ToastController,
    private translate: TranslateService
  ) {}

  ionViewWillEnter(): void {
    if (!this.profilVerifie) {
      this.verifierProfil();
    }
  }

  // ── Vérification profil existant ───────────────
  verifierProfil(): void {
    this.loading = true;
    this.iaService.getProfil().pipe(
      catchError(() => of(null))
    ).subscribe(profil => {
      this.profilVerifie = true;
      if (!profil) {
        this.loading = false;
        this.showWizard = true;
      } else {
        this.profil = profil;
        this.lancerAnalyse();
      }
    });
  }

  // ── Lancer l'analyse complète ──────────────────
  lancerAnalyse(): void {
    this.loading = true;
    this.analyseErreur = false;
    this.iaService.analyser().subscribe({
      next: (res) => {
        this.loading = false;
        this.analyse = res;
        this.recommandations = (res.recommandations || [])
          .sort((a, b) => this.prioriteOrdre(a.priorite) - this.prioriteOrdre(b.priorite))
          .map(r => ({ ...r, traitee: false }));
      },
      error: (e: any) => {
        this.loading = false;
        this.analyseErreur = true;
        const msg = e?.error?.erreur || e?.error?.message || e?.message;
        if (msg) { this.afficherToast(msg, 'danger'); }
      }
    });
  }

  relancer(): void {
    this.analyseErreur = false;
    this.lancerAnalyse();
  }

  // ── Wizard : navigation ────────────────────────
  wizardNext(): void {
    if (this.wizardStep < 5) { this.wizardStep++; }
    else { this.terminerWizard(); }
  }

  wizardPrev(): void {
    if (this.wizardStep > 1) { this.wizardStep--; }
  }

  wizardStepValide(): boolean {
    switch (this.wizardStep) {
      case 1: return !!this.profil.typeBoutique;
      case 2: return this.profil.joursApprovisionnement.length > 0;
      case 3: return this.profil.objectifStockJours > 0;
      case 4: return this.profil.margeObjectif > 0;
      case 5: return this.profil.delaiReglementCredit > 0;
      default: return true;
    }
  }

  toggleJour(jour: string): void {
    const idx = this.profil.joursApprovisionnement.indexOf(jour);
    if (idx >= 0) {
      this.profil.joursApprovisionnement.splice(idx, 1);
    } else {
      this.profil.joursApprovisionnement.push(jour);
    }
  }

  jourSelectionne(jour: string): boolean {
    return this.profil.joursApprovisionnement.includes(jour);
  }

  terminerWizard(): void {
    this.wizardLoading = true;
    this.iaService.sauvegarderProfil(this.profil).subscribe({
      next: () => {
        this.wizardLoading = false;
        this.showWizard = false;
        this.afficherToast('IA.PROFIL_SAVED', 'success');
        this.lancerAnalyse();
      },
      error: (e: any) => {
        this.wizardLoading = false;
        const msg = e?.error?.erreur || e?.error?.message || e?.message
          || this.translate.instant('IA.ANALYZE_ERROR');
        this.toastCtrl.create({ message: msg, duration: 3500, color: 'danger', position: 'bottom' })
          .then(t => t.present());
      }
    });
  }

  // ── Feedback recommandations ───────────────────
  suivreReco(reco: RecoAvecEtat): void {
    this.iaService.enregistrerFeedback(reco.id, 'SUIVIE').subscribe(() => {});
    reco.traitee = true;
    reco.etatFeedback = 'SUIVIE';
  }

  ignorerReco(reco: RecoAvecEtat): void {
    this.iaService.enregistrerFeedback(reco.id, 'IGNOREE').subscribe(() => {});
    reco.traitee = true;
    reco.etatFeedback = 'IGNOREE';
  }

  // ── Helpers visuel ─────────────────────────────
  scoreColor(): string {
    const s = this.analyse?.scoreGlobal ?? 0;
    if (s >= 70) return '#0e9f6e';
    if (s >= 40) return '#f59e0b';
    return '#ef4444';
  }

  scoreTextColor(): string {
    const s = this.analyse?.scoreGlobal ?? 0;
    if (s >= 70) return '#065f46';
    if (s >= 40) return '#b45309';
    return '#991b1b';
  }

  scoreDash(): string {
    const circumference = 2 * Math.PI * 52;
    const s = Math.min(100, Math.max(0, this.analyse?.scoreGlobal ?? 0));
    const filled = (s / 100) * circumference;
    return `${filled} ${circumference}`;
  }

  tendanceIcon(): string {
    switch (this.analyse?.tendanceCA) {
      case 'FORTE_HAUSSE': return 'trending-up-outline';
      case 'HAUSSE':       return 'arrow-up-outline';
      case 'STABLE':       return 'remove-outline';
      case 'BAISSE':       return 'arrow-down-outline';
      case 'FORTE_BAISSE': return 'trending-down-outline';
      default:             return 'remove-outline';
    }
  }

  tendanceColor(): string {
    switch (this.analyse?.tendanceCA) {
      case 'FORTE_HAUSSE': return '#0e9f6e';
      case 'HAUSSE':       return '#10b981';
      case 'STABLE':       return '#6b7280';
      case 'BAISSE':       return '#f59e0b';
      case 'FORTE_BAISSE': return '#ef4444';
      default:             return '#6b7280';
    }
  }

  tendanceLabelKey(): string {
    switch (this.analyse?.tendanceCA) {
      case 'FORTE_HAUSSE': return 'IA.TREND_FORTE_HAUSSE';
      case 'HAUSSE':       return 'IA.TREND_HAUSSE';
      case 'STABLE':       return 'IA.TREND_STABLE';
      case 'BAISSE':       return 'IA.TREND_BAISSE';
      case 'FORTE_BAISSE': return 'IA.TREND_FORTE_BAISSE';
      default:             return 'IA.TREND_STABLE';
    }
  }

  prioriteBadgeColor(p: string): string {
    switch (p) {
      case 'CRITIQUE': return 'danger';
      case 'HAUTE':    return 'warning';
      case 'MOYENNE':  return 'primary';
      default:         return 'medium';
    }
  }

  prioriteLabelKey(p: string): string {
    switch (p) {
      case 'CRITIQUE': return 'IA.PRIORITY_CRITICAL';
      case 'HAUTE':    return 'IA.PRIORITY_HIGH';
      case 'MOYENNE':  return 'IA.PRIORITY_MEDIUM';
      default:         return 'IA.PRIORITY_LOW';
    }
  }

  private prioriteOrdre(p: string): number {
    switch (p) {
      case 'CRITIQUE': return 0;
      case 'HAUTE':    return 1;
      case 'MOYENNE':  return 2;
      default:         return 3;
    }
  }

  previsionMax(): number {
    const details = this.analyse?.previsionCA30JoursDetail || [];
    if (!details.length) return 1;
    return Math.max(...details.map(d => d.prevision), 1);
  }

  barHeight(val: number): string {
    const max = this.previsionMax();
    return `${Math.max(4, (val / max) * 100)}%`;
  }

  segmentCount(key: string): number {
    return this.analyse?.segmentsClients?.[key] ?? 0;
  }

  formatPrix(val: number): string {
    const n = Math.round(val || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  getTotalClients(): number {
    if (!this.analyse?.segmentsClients) return 0;
    return Object.values(this.analyse.segmentsClients).reduce((s, n) => s + n, 0);
  }

  trackById(_: number, item: any): any { return item.id; }

  private async afficherToast(messageKey: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const message = this.translate.instant(messageKey);
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }
}
