import { Component, OnDestroy } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { WebSocketService } from '../../services/websocket.service';
import {
  Caisse,
  CaisseService,
  CreditInfo,
  ModePaiementCaisse,
  OperationCaisse,
  StatistiquesCaisse,
  TransfertCaisseBanqueRequest
} from '../../services/caisse.service';
import { AuthService } from '../../services/auth.service';
import { Compte, CompteService } from '../../services/compte.service';

@Component({
  selector: 'app-caisse',
  templateUrl: './caisse.page.html',
  styleUrls: ['./caisse.page.scss'],
  standalone: false
})
export class CaissePage implements OnDestroy {
  private wsSub?: Subscription;
  caisse?: Caisse;
  operations: OperationCaisse[] = [];
  operationsFiltrees: OperationCaisse[] = [];
  credits: CreditInfo[] = [];
  creditsEnRetard: CreditInfo[] = [];
  statsJour?: StatistiquesCaisse;
  comptes: Compte[] = [];
  segment: 'etat' | 'credits' | 'operations' | 'stats' = 'etat';
  loadingStats = false;
  loadingOperations = false;
  loadingCredits = false;

  // Filtres opérations
  opPeriode: 'today' | 'week' | 'month' | 'year' = 'today';
  opTypeFilter = '';
  opSearch = '';

  // Détail opération
  showOpDetail = false;
  selectedOp?: OperationCaisse;

  operationType: 'entree' | 'sortie' = 'entree';
  operationForm = {
    montant: 0,
    motif: '',
    modePaiement: ModePaiementCaisse.ESPECES,
    referencePaiement: ''
  };

  reglement = {
    venteCreditId: 0,
    montantRegle: 0,
    modePaiement: ModePaiementCaisse.ESPECES,
    referencePaiement: ''
  };

  // Règlement par groupe
  selectedCreditsForGroup: Set<number> = new Set();
  showGroupReglementPanel = false;

  transfertForm = {
    compteId: null as number | null,
    montant: 0,
    motif: '',
    reference: ''
  };
  showTransfertModal = false;

  ModePaiementCaisse = ModePaiementCaisse;

  constructor(
    public caisseService: CaisseService,
    private auth: AuthService,
    private compteService: CompteService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private ws: WebSocketService
  ) {}

  ionViewWillEnter(): void {
    this.load();
    // Abonnement WebSocket — refresh auto quand caisse ou ventes changent
    this.wsSub = this.ws.subscribeTopic('/topic/caisse').subscribe(() => {
      this.load();
    });
  }

  ionViewWillLeave(): void {
    this.wsSub?.unsubscribe();
    this.ws.unsubscribeTopic('/topic/caisse');
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }

  load(event?: any): void {
    this.caisseService.getEtatCaisse().subscribe({
      next: caisse => this.caisse = caisse,
      error: error => this.presentToast(error.message || 'Caisse indisponible', 'danger')
    });
    this.loadOperationsForPeriod();
    this.loadingCredits = true;
    this.caisseService.getCreditsNonRegles().subscribe({
      next: credits => { this.credits = credits.filter(c => !c.venteAnnulee); this.loadingCredits = false; },
      error: () => { this.credits = []; this.loadingCredits = false; }
    });
    this.caisseService.getCreditsEnRetard().subscribe(credits => {
      this.creditsEnRetard = credits.filter(c => !c.venteAnnulee);
      event?.target?.complete();
    });
    this.loadStatsJour();
  }

  loadStatsJour(): void {
    this.loadingStats = true;
    this.caisseService.getStatistiquesDuJour().subscribe({
      next: stats => {
        this.statsJour = stats;
        this.loadingStats = false;
      },
      error: () => this.loadingStats = false
    });
  }

  async openCash(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Ouvrir la caisse',
      message: 'Confirmer l\'ouverture de la caisse pour aujourd\'hui ?',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Ouvrir',
          cssClass: 'alert-btn-primary',
          handler: () => {
            this.caisseService.ouvrirCaisse().subscribe({
              next: caisse => { this.caisse = caisse; this.presentToast('Caisse ouverte ✓'); },
              error: error => this.presentToast(error.message || 'Ouverture impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  closeCash(): void {
    this.caisseService.fermerCaisse(this.auth.getUserId()).subscribe({
      next: caisse => {
        this.caisse = caisse;
        this.presentToast('Caisse fermée');
      },
      error: error => this.presentToast(error.message || 'Fermeture impossible', 'danger')
    });
  }

  saveOperation(): void {
    if (!this.operationForm.montant || !this.operationForm.motif.trim()) {
      this.presentToast('Montant et motif obligatoires', 'danger');
      return;
    }

    const payload = { ...this.operationForm, utilisateurId: this.auth.getUserId() };
    const request = this.operationType === 'entree'
      ? this.caisseService.entreeCaisse(payload)
      : this.caisseService.sortieCaisse(payload);

    request.subscribe({
      next: () => {
        this.presentToast('Opération enregistrée');
        this.operationForm = { montant: 0, motif: '', modePaiement: ModePaiementCaisse.ESPECES, referencePaiement: '' };
        this.load();
      },
      error: error => this.presentToast(error.message || 'Opération impossible', 'danger')
    });
  }

  prepareReglement(credit: CreditInfo): void {
    this.segment = 'credits';
    this.reglement = {
      venteCreditId: credit.venteId,
      montantRegle: credit.montantRestant,
      modePaiement: ModePaiementCaisse.ESPECES,
      referencePaiement: ''
    };
  }

  onCreditSelected(venteId: number): void {
    const credit = this.credits.find(c => c.venteId === venteId);
    if (credit) {
      this.reglement.montantRegle = credit.montantRestant;
    }
  }

  getCreditByVenteId(venteId: number): CreditInfo | undefined {
    return this.credits.find(c => c.venteId === venteId);
  }

  saveReglement(): void {
    if (!this.reglement.venteCreditId || this.reglement.venteCreditId === 0) {
      this.presentToast('Sélectionnez un crédit', 'danger');
      return;
    }
    if (!this.reglement.montantRegle || this.reglement.montantRegle <= 0) {
      this.presentToast('Le montant doit être supérieur à 0', 'danger');
      return;
    }

    const credit = this.credits.find(c => c.venteId === this.reglement.venteCreditId);
    if (credit && this.reglement.montantRegle > credit.montantRestant) {
      this.presentToast(`Montant max: ${this.caisseService.formatPrice(credit.montantRestant)}`, 'danger');
      return;
    }

    this.caisseService.reglementCredit({ ...this.reglement, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => {
        this.presentToast('Règlement enregistré ✓');
        this.reglement = { venteCreditId: 0, montantRegle: 0, modePaiement: ModePaiementCaisse.ESPECES, referencePaiement: '' };
        this.load();
      },
      error: error => this.presentToast(error.message || 'Règlement impossible', 'danger')
    });
  }

  openTransfertModal(): void {
    if (!this.caisse?.estOuverte) {
      this.presentToast('La caisse doit être ouverte pour transférer', 'danger');
      return;
    }
    this.compteService.getTousLesComptes().subscribe({
      next: comptes => {
        this.comptes = comptes.filter((c: Compte) => c.actif !== false);
        this.transfertForm = { compteId: null, montant: 0, motif: '', reference: '' };
        this.showTransfertModal = true;
      },
      error: () => this.presentToast('Impossible de charger les comptes', 'danger')
    });
  }

  validerTransfert(): void {
    if (!this.transfertForm.compteId || !this.transfertForm.montant || !this.transfertForm.motif.trim()) {
      this.presentToast('Compte, montant et motif obligatoires', 'danger');
      return;
    }

    const request: TransfertCaisseBanqueRequest = {
      compteId: this.transfertForm.compteId,
      montant: this.transfertForm.montant,
      motif: this.transfertForm.motif,
      utilisateurId: this.auth.getUserId(),
      reference: this.transfertForm.reference || undefined
    };

    this.caisseService.transfererVersBanque(request).subscribe({
      next: () => {
        this.presentToast('Transfert effectué');
        this.showTransfertModal = false;
        this.load();
      },
      error: error => this.presentToast(error.message || 'Transfert impossible', 'danger')
    });
  }

  async confirmCloseCash(): Promise<void> {
    const solde = this.caisseService.formatPrice(this.caisse?.soldeActuel || 0);
    const alert = await this.alertCtrl.create({
      header: '⚠️ Fermer la caisse',
      message: `Solde actuel : <strong>${solde}</strong><br><br>La caisse sera fermée et les opérations ne seront plus possibles jusqu'à la réouverture.`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Confirmer la fermeture', cssClass: 'alert-btn-danger', handler: () => this.closeCash() }
      ]
    });
    await alert.present();
  }

  money(value: number): string {
    return this.caisseService.formatPrice(value);
  }

  formatDate(value: string): string {
    return this.caisseService.formatDateLong(value);
  }

  getTypeLabel(type: string): string {
    return this.caisseService.getTypeOperationLabel(type as any);
  }

  getTypeClass(type: string): string {
    return this.caisseService.getTypeOperationClass(type as any);
  }

  getCreditStatus(credit: CreditInfo): string {
    return this.caisseService.getCreditStatusText(credit);
  }

  // ==================== OPÉRATIONS ====================

  loadOperationsForPeriod(): void {
    this.loadingOperations = true;
    const req = this.opPeriode === 'today' ? this.caisseService.getOperationsDuJour()
      : this.opPeriode === 'week' ? this.caisseService.getOperationsDeLaSemaine()
      : this.opPeriode === 'month' ? this.caisseService.getOperationsDuMois()
      : this.caisseService.getOperationsDeLAnnee();

    req.subscribe({
      next: ops => {
        this.operations = ops;
        this.applyOpFilters();
        this.loadingOperations = false;
      },
      error: () => { this.operations = []; this.operationsFiltrees = []; this.loadingOperations = false; }
    });
  }

  setPeriodeOp(p: 'today' | 'week' | 'month' | 'year'): void {
    this.opPeriode = p;
    this.loadOperationsForPeriod();
  }

  applyOpFilters(): void {
    const term = this.opSearch.trim().toLowerCase();
    this.operationsFiltrees = this.operations.filter(op => {
      if (this.opTypeFilter && op.type !== this.opTypeFilter) return false;
      if (term && ![ op.motif, op.clientNom, op.utilisateurNom, op.numeroVente ]
        .filter(Boolean).some(v => `${v}`.toLowerCase().includes(term))) return false;
      return true;
    });
  }

  openOpDetail(op: OperationCaisse): void {
    this.selectedOp = op;
    this.showOpDetail = true;
  }

  isOpEntree(type: string): boolean {
    return ['ENTREE', 'VENTE_COMPTANT', 'REGLEMENT_CREDIT', 'OUVERTURE'].includes(type);
  }

  isOpSortie(type: string): boolean {
    return ['SORTIE', 'PAIEMENT_FOURNISSEUR', 'PAIEMENT_EMPLOYE', 'FERMETURE'].includes(type);
  }

  isOpCredit(type: string): boolean {
    return type === 'VENTE_CREDIT';
  }

  getOpColor(type: string): string {
    if (this.isOpEntree(type)) return 'success';
    if (this.isOpSortie(type)) return 'danger';
    if (this.isOpCredit(type)) return 'warning';
    return 'medium';
  }

  getOpSign(type: string): string {
    return this.isOpSortie(type) ? '−' : '+';
  }

  getTotalOps(): number {
    return this.operationsFiltrees.reduce((s, op) => {
      return this.isOpSortie(op.type) ? s - op.montant : s + op.montant;
    }, 0);
  }

  totalMontantCredits(): number {
    return this.credits.reduce((s, c) => s + (c.montantRestant || 0), 0);
  }

  toggleCreditGroup(venteId: number): void {
    if (this.selectedCreditsForGroup.has(venteId)) {
      this.selectedCreditsForGroup.delete(venteId);
    } else {
      this.selectedCreditsForGroup.add(venteId);
    }
  }

  isCreditSelected(venteId: number): boolean {
    return this.selectedCreditsForGroup.has(venteId);
  }

  totalGroupSelected(): number {
    return this.credits
      .filter(c => this.selectedCreditsForGroup.has(c.venteId))
      .reduce((s, c) => s + (c.montantRestant || 0), 0);
  }

  async regleGroupeCredits(): Promise<void> {
    if (!this.selectedCreditsForGroup.size) {
      this.presentToast('Sélectionnez au moins un crédit', 'danger');
      return;
    }
    const total = this.totalGroupSelected();
    const alert = await this.alertCtrl.create({
      header: 'Règlement par groupe',
      message: `${this.selectedCreditsForGroup.size} crédit(s) · Total : <strong>${this.caisseService.formatPrice(total)}</strong>`,
      inputs: [
        { name: 'mode', type: 'text', placeholder: 'Mode paiement (ESPECES)', value: 'ESPECES' },
        { name: 'reference', type: 'text', placeholder: 'Référence (optionnel)' }
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Confirmer le règlement groupe',
          cssClass: 'alert-btn-success',
          handler: async (data) => {
            const venteIds = Array.from(this.selectedCreditsForGroup);
            const mode = (data.mode || 'ESPECES') as ModePaiementCaisse;
            let success = 0;
            let errors = 0;
            for (const venteId of venteIds) {
              const credit = this.credits.find(c => c.venteId === venteId);
              if (!credit || !credit.venteId) { errors++; continue; }
              try {
                await this.caisseService.reglementCredit({
                  venteCreditId: credit.venteId,
                  montantRegle: credit.montantRestant,
                  modePaiement: mode,
                  referencePaiement: data.reference || '',
                  utilisateurId: this.auth.getUserId()
                }).toPromise();
                success++;
              } catch {
                errors++;
              }
            }
            this.selectedCreditsForGroup.clear();
            if (success > 0) this.presentToast(`${success} crédit(s) réglé(s) ✓`);
            if (errors > 0) this.presentToast(`${errors} erreur(s) — vérifiez les crédits`, 'danger');
            this.load();
          }
        }
      ]
    });
    await alert.present();
  }

  selectAllCredits(): void {
    this.credits.forEach(c => { if (c.venteId) this.selectedCreditsForGroup.add(c.venteId); });
  }

  clearSelection(): void {
    this.selectedCreditsForGroup.clear();
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
