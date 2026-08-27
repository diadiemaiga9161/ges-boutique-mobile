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
  ReconciliationVendeur,
  StatistiquesCaisse,
  TransfertCaisseBanqueRequest
} from '../../services/caisse.service';
import { AuthService } from '../../services/auth.service';
import { Compte, CompteService } from '../../services/compte.service';
import { BoutiqueService } from '../../services/boutique.service';

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
  // Bénéfice du mois : dernier mois CLÔTURÉ (le précédent, entièrement terminé), pas le mois
  // en cours — même logique et même raison que côté Angular (toutes les entrées ET sorties
  // du mois affiché sont déjà connues, donc le chiffre est fiable et non un instantané partiel).
  statsMois?: StatistiquesCaisse;
  moisAffiche?: Date;
  comptes: Compte[] = [];
  segment: 'etat' | 'credits' | 'operations' | 'stats' | 'reconciliation' = 'etat';
  loadingStats = false;
  loadingOperations = false;
  loadingCredits = false;

  // Réconciliation caisse par vendeur — rapport en lecture seule (voir loadReconciliation()).
  reconciliationDate: string = new Date().toISOString().split('T')[0];
  reconciliationToday: string = new Date().toISOString().split('T')[0];
  reconciliationList: ReconciliationVendeur[] = [];
  loadingReconciliation = false;

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

  // Le règlement de crédit ne se fait plus depuis la Caisse (uniquement depuis la page
  // dédiée "Crédits") : la Caisse affiche seulement la liste en lecture seule, groupée
  // par client, pour ne pas avoir deux endroits différents où encaisser un même crédit.
  showCreditsClientModal = false;
  selectedClientCreditsNom = '';

  transfertForm = {
    compteId: null as number | null,
    montant: 0,
    motif: '',
    reference: ''
  };
  showTransfertModal = false;

  ModePaiementCaisse = ModePaiementCaisse;
  Math = Math;

  trackById = (_: number, item: any) => item.id;

  constructor(
    public caisseService: CaisseService,
    private auth: AuthService,
    private compteService: CompteService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private ws: WebSocketService,
    private boutiqueService: BoutiqueService
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
    this.loadStatsMois();
    this.loadReconciliation();
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

  loadStatsMois(): void {
    const aujourdhui = new Date();
    const finMoisPrecedent = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 0);
    const debutMoisPrecedent = new Date(finMoisPrecedent.getFullYear(), finMoisPrecedent.getMonth(), 1);
    this.moisAffiche = finMoisPrecedent;
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    this.caisseService.getStatistiquesParPeriode(fmt(debutMoisPrecedent), fmt(finMoisPrecedent)).subscribe({
      next: stats => { this.statsMois = stats; },
      error: () => {}
    });
  }

  /** Rapport en lecture seule : total par vendeur (ventes espèces/crédit, règlements
   * crédit encaissés, montant total à remettre) pour la date sélectionnée. */
  loadReconciliation(): void {
    this.loadingReconciliation = true;
    this.caisseService.getReconciliationVendeurs(this.reconciliationDate).subscribe({
      next: liste => { this.reconciliationList = liste; this.loadingReconciliation = false; },
      error: () => { this.reconciliationList = []; this.loadingReconciliation = false; }
    });
  }

  // ── Cartes KPI (mêmes calculs que la page Caisse Angular) ─────────────────

  get ecart(): number { return this.caisse?.ecart || 0; }

  get profitNetMois(): number { return this.statsMois?.soldeNetPeriode ?? 0; }
  get isPerteMois(): boolean { return this.profitNetMois < 0; }
  get labelBilanceMois(): string { return this.isPerteMois ? 'Perte nette' : 'Bénéfice net'; }
  get nomMoisCourant(): string {
    return (this.moisAffiche || new Date()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  get montantTotalCredits(): number {
    return this.credits.reduce((sum, c) => sum + (c.montantRestant || 0), 0);
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

  /** Crédits en cours regroupés par client, en lecture seule (même principe que la page Caisse Angular). */
  creditsGroupesParClient(): { nom: string; count: number; totalTotal: number; totalVerse: number; totalRestant: number; enRetard: boolean }[] {
    const map = new Map<string, CreditInfo[]>();
    for (const c of this.credits) {
      const nom = (c.clientNom || 'Client') + (c.clientPrenom ? ' ' + c.clientPrenom : '');
      if (!map.has(nom)) map.set(nom, []);
      map.get(nom)!.push(c);
    }
    return Array.from(map.entries()).map(([nom, liste]) => ({
      nom,
      count: liste.length,
      totalTotal: liste.reduce((s, c) => s + (c.montantTotal || 0), 0),
      totalVerse: liste.reduce((s, c) => s + (c.montantVerse || 0), 0),
      totalRestant: liste.reduce((s, c) => s + (c.montantRestant || 0), 0),
      enRetard: liste.some(c => c.enRetard)
    })).sort((a, b) => b.totalRestant - a.totalRestant);
  }

  get selectedClientCreditsList(): CreditInfo[] {
    return this.credits.filter(c => ((c.clientNom || 'Client') + (c.clientPrenom ? ' ' + c.clientPrenom : '')) === this.selectedClientCreditsNom);
  }

  openCreditsClientModal(nom: string): void {
    this.selectedClientCreditsNom = nom;
    this.showCreditsClientModal = true;
  }

  closeCreditsClientModal(): void {
    this.showCreditsClientModal = false;
    this.selectedClientCreditsNom = '';
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

  getOperationUtilisateurLabel(op: any): string {
    return op?.utilisateurNom
      || op?.utilisateur?.nomComplet
      || op?.utilisateur?.username
      || op?.nomUtilisateur
      || op?.utilisateurName
      || op?.effectuePar
      || op?.utilisateurId
      || 'Système';
  }

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

  imprimerCreditsEnCours(): void {
    const shop = this.boutiqueService.getInfo();
    const date = new Date().toLocaleDateString('fr-FR');
    const liste = this.credits;
    const totalAccorde = liste.reduce((s, c) => s + c.montantTotal, 0);
    const totalVerse = liste.reduce((s, c) => s + c.montantVerse, 0);
    const totalRestant = liste.reduce((s, c) => s + c.montantRestant, 0);

    const qrData = encodeURIComponent('Credits en cours ' + (shop.nom || '') + ' ' + date + ' Restant: ' + this.money(totalRestant));
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=' + qrData;

    const lignes = liste.map((c, i) =>
      '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#fafafa') + (c.enRetard ? ';border-left:3px solid #ef4444' : '') + '">' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">' + c.clientNom + (c.clientPrenom ? ' ' + c.clientPrenom : '') + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">' + (c.clientTelephone || '—') + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right">' + this.money(c.montantTotal) + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;color:#16a34a">' + this.money(c.montantVerse) + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700;color:#d97706">' + this.money(c.montantRestant) + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:center">' + (c.enRetard ? '<span style="color:#ef4444;font-weight:700">En retard</span>' : '<span style="color:#16a34a">OK</span>') + '</td>' +
      '</tr>'
    ).join('');

    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Credits en cours</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#fffbeb;padding:24px;font-size:13px;color:#1e293b}' +
      '.sheet{background:#fff;max-width:950px;margin:0 auto;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}' +
      '.hdr{background:linear-gradient(135deg,#d97706,#f59e0b);color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start}' +
      '.hdr h1{font-size:22px;font-weight:900;margin-bottom:4px}.hdr p{font-size:12px;opacity:.75;margin-top:3px}' +
      '.body{padding:24px 32px}' +
      '.kpis{display:flex;gap:12px;margin-bottom:20px}' +
      '.kpi{flex:1;border-radius:10px;padding:14px 16px;text-align:center}' +
      '.kpi-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:.75;margin-bottom:4px}' +
      '.kpi-val{font-size:18px;font-weight:900}' +
      '.kpi--blue{background:#dbeafe;color:#1d4ed8}.kpi--green{background:#dcfce7;color:#15803d}.kpi--amber{background:#fef3c7;color:#b45309}' +
      'table{width:100%;border-collapse:collapse}thead tr{background:linear-gradient(135deg,#d97706,#f59e0b);color:#fff}' +
      'thead th{padding:9px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left;border:1px solid rgba(255,255,255,.1)}' +
      '.ftr{background:#fef3c7;padding:14px 32px;font-size:11px;color:#92400e;text-align:center}' +
      '.btn-bar{display:flex;gap:8px;margin-bottom:16px}' +
      '.btn-print{background:#d97706;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}' +
      '.btn-close{background:#64748b;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}' +
      '@media print{.btn-bar{display:none}body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}' +
      '</style></head><body>' +
      '<div class="sheet">' +
      '<div class="hdr"><div><h1>Credits en cours</h1><p>' + (shop.nom || 'Ges Boutique') + '</p><p>Genere le ' + date + '</p></div>' +
      '<div style="text-align:right"><img src="' + qrUrl + '" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px" alt="QR"></div></div>' +
      '<div class="body">' +
      '<div class="btn-bar"><button class="btn-print" onclick="window.print()">Imprimer / PDF</button><button class="btn-close" onclick="window.close()">Fermer</button></div>' +
      '<div class="kpis">' +
      '<div class="kpi kpi--blue"><div class="kpi-lbl">Total accorde</div><div class="kpi-val">' + this.money(totalAccorde) + '</div></div>' +
      '<div class="kpi kpi--green"><div class="kpi-lbl">Total verse</div><div class="kpi-val">' + this.money(totalVerse) + '</div></div>' +
      '<div class="kpi kpi--amber"><div class="kpi-lbl">Total restant</div><div class="kpi-val">' + this.money(totalRestant) + '</div></div>' +
      '</div>' +
      (liste.length ? '<table><thead><tr><th>Client</th><th>Telephone</th><th style="text-align:right">Accorde</th><th style="text-align:right">Verse</th><th style="text-align:right">Restant</th><th style="text-align:center">Statut</th></tr></thead><tbody>' + lignes + '</tbody></table>' : '<p style="text-align:center;color:#64748b;padding:24px">Aucun credit en cours</p>') +
      '</div><div class="ftr">' + (shop.nom || 'Ges Boutique') + ' · Credits en cours · ' + date + ' · ' + liste.length + ' credit(s)</div></div>' +
      '</body></html>';

    this.openLocalOverlay(html);
  }

  private openLocalOverlay(html: string): void {
    document.getElementById('caisse-pdf-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'caisse-pdf-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:rgba(0,0,0,.65)';
    const btnFloat = document.createElement('button');
    btnFloat.textContent = '✕';
    btnFloat.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:12px;background:rgba(0,0,0,.75);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:20px;font-weight:700;cursor:pointer;z-index:2;line-height:1';
    btnFloat.addEventListener('click', () => overlay.remove());
    overlay.appendChild(btnFloat);
    const frame = document.createElement('iframe');
    frame.style.cssText = 'flex:1;width:100%;border:none;background:#fffbeb';
    frame.setAttribute('srcdoc', html);
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#d97706;padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap';
    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fermer';
    btnClose.style.cssText = 'background:#fff;color:#d97706;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
    btnClose.addEventListener('click', () => overlay.remove());
    const btnPrint = document.createElement('button');
    btnPrint.textContent = '🖨 Imprimer';
    btnPrint.style.cssText = 'background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
    btnPrint.addEventListener('click', () => frame.contentWindow?.print());
    bar.appendChild(btnClose);
    bar.appendChild(btnPrint);
    overlay.appendChild(frame);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
