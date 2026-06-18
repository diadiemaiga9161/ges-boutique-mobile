import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { FactureService } from '../../services/facture.service';
import { Produit, ProductService } from '../../services/product.service';
import { RemiseType, RetourVenteRequest, Statistiques, VenteMap, VenteService, VentesDuJourResponse } from '../../services/vente.service';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-sales',
  templateUrl: './sales.page.html',
  styleUrls: ['./sales.page.scss'],
  standalone: false
})
export class SalesPage implements OnDestroy {
  private wsSub?: Subscription;
  private alertTimer?: any;
  sales: VenteMap[] = [];
  filtered: VenteMap[] = [];
  query = '';
  typeFilter = '';
  modeFilter = '';
  dateDebut = '';
  dateFin = '';
  activePeriod: 'today' | 'week' | 'month' | 'all' = 'today';
  loading = false;
  selected?: VenteMap;

  // Modals
  showStatsModal = false;
  showDetailModal = false;
  showModifyModal = false;
  showQrSaleModal = false;
  showRetourModal = false;
  selectedVentePourRetour?: VenteMap;
  retourLignes: { ligneVenteId?: number; produitId: number; produitNom: string; prixUnitaire: number; quantiteMax: number; quantiteRetournee: number; selected: boolean }[] = [];
  retourMotif = '';
  selectedVente?: VenteMap;
  selectedSaleForQr?: VenteMap;
  qrSaleDataUrl: SafeUrl | null = null;
  private qrSaleBlobUrl: string | null = null;
  venteAModifier?: VenteMap;
  modifyLines: { produitId: number; produitNom: string; quantite: number; prixUnitaire: number; sousTotal: number; original: any }[] = [];
  modificationMotif = '';
  produits: Produit[] = [];
  stats?: Statistiques;
  loadingStats = false;

  constructor(
    public venteService: VenteService,
    private factureService: FactureService,
    private productService: ProductService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private ws: WebSocketService,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ionViewWillEnter(): void {
    this.filterToday();
    this.productService.getProducts().subscribe({ next: p => this.produits = p, error: () => {} });
    this.wsSub = this.ws.subscribeTopic('/topic/ventes').subscribe(() => {
      this.load();
    });
    this.scheduleAlerte22h();
  }

  ionViewWillLeave(): void {
    this.wsSub?.unsubscribe();
    this.ws.unsubscribeTopic('/topic/ventes');
    if (this.alertTimer) { clearTimeout(this.alertTimer); this.alertTimer = undefined; }
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
  }

  // ==================== ALERTE 22H ====================

  private scheduleAlerte22h(): void {
    const todayKey = `alerte22h_${new Date().toLocaleDateString('fr-FR')}`;
    if (localStorage.getItem(todayKey)) return;

    const now = new Date();
    const alerte = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 22, 0, 0, 0);

    if (now >= alerte) {
      this.afficherAlerte22h(todayKey);
      return;
    }

    const delai = alerte.getTime() - now.getTime();
    this.alertTimer = setTimeout(() => this.afficherAlerte22h(todayKey), delai);
  }

  private async afficherAlerte22h(todayKey: string): Promise<void> {
    localStorage.setItem(todayKey, '1');
    const alert = await this.alertCtrl.create({
      header: '⏰ Fin de journée proche',
      message: 'Il est 22h00. Les ventes du jour se terminent à <strong>23h59</strong>. Les ventes enregistrées après minuit seront comptées dans la journée du lendemain.',
      buttons: [{ text: 'Compris', role: 'cancel' }],
      cssClass: 'alerte-22h'
    });
    await alert.present();
  }

  // ==================== CHARGEMENT ====================

  load(event?: any): void {
    if (this.activePeriod === 'today') {
      this.filterToday();
    } else {
      this.loadAll();
    }
    event?.target?.complete();
  }

  private loadAll(): void {
    this.loading = true;
    this.venteService.getAllVentes().subscribe({
      next: (result: VenteMap[]) => {
        this.sales = result;
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ==================== FILTRES PÉRIODE ====================

  filterToday(): void {
    this.activePeriod = 'today';
    this.dateDebut = '';
    this.dateFin = '';
    this.loading = true;
    this.venteService.getVentesDuJour().subscribe({
      next: (r: VentesDuJourResponse) => { this.sales = r.ventes || []; this.applyFilter(); this.loading = false; },
      error: () => this.loading = false
    });
  }

  filterWeek(): void {
    this.activePeriod = 'week';
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    start.setHours(0, 0, 0, 0);
    this.dateDebut = this.toLocalDateStr(start);
    this.dateFin = this.toLocalDateStr(now);
    this.loadAll();
  }

  filterMonth(): void {
    this.activePeriod = 'month';
    const now = new Date();
    this.dateDebut = this.toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    this.dateFin = this.toLocalDateStr(now);
    this.loadAll();
  }

  private toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  filterAll(): void {
    this.activePeriod = 'all';
    this.dateDebut = '';
    this.dateFin = '';
    this.loadAll();
  }

  // ==================== FILTRES LOCAUX ====================

  applyFilter(): void {
    const term = this.query.trim().toLowerCase();
    this.filtered = this.sales.filter(sale => {
      if (term && ![sale.numeroVente, sale.clientNom, sale.clientTelephone, sale.vendeurNom]
        .filter(Boolean).some(v => `${v}`.toLowerCase().includes(term))) return false;

      if (this.typeFilter === 'COMPTANT' && sale.estCredit) return false;
      if (this.typeFilter === 'CREDIT' && !sale.estCredit) return false;
      if (this.typeFilter === 'CREDIT_EN_RETARD' && !(sale.estCredit && !sale.creditRegle && this.isCreditEnRetard(sale))) return false;
      if (this.modeFilter && sale.modePaiement !== this.modeFilter) return false;

      if (this.dateDebut || this.dateFin) {
        const d = new Date(sale.dateVente);
        if (this.dateDebut && d < new Date(this.dateDebut + 'T00:00:00')) return false;
        if (this.dateFin && d > new Date(this.dateFin + 'T23:59:59')) return false;
      }
      return true;
    });
  }

  // ==================== CALCULS ====================

  caTotal(): number    { return this.filtered.reduce((s, v) => s + Number(v.montantTotal || 0), 0); }
  caJour(): number     { const t = new Date().toDateString(); return this.sales.filter(v => new Date(v.dateVente).toDateString() === t).reduce((s, v) => s + Number(v.montantTotal || 0), 0); }
  caComptant(): number { return this.filtered.filter(v => !v.estCredit).reduce((s, v) => s + Number(v.montantTotal || 0), 0); }
  countJour(): number  { const t = new Date().toDateString(); return this.sales.filter(v => new Date(v.dateVente).toDateString() === t).length; }
  countComptant(): number { return this.filtered.filter(v => !v.estCredit).length; }
  totalCredit(): number  { return this.filtered.filter(v => v.estCredit && !v.creditRegle).reduce((s, v) => s + Number(v.montantRestant || 0), 0); }

  money(v: number): string { return this.venteService.formatPrice(v); }
  isCreditEnRetard(v: VenteMap): boolean { return this.venteService.isCreditEnRetard(v); }

  getBadgeColor(sale: VenteMap): string {
    if (sale.annulee) return 'medium';
    if (!sale.estCredit) return 'primary';
    if (sale.creditRegle) return 'success';
    if (this.isCreditEnRetard(sale)) return 'danger';
    return 'warning';
  }

  getBadgeLabel(sale: VenteMap): string {
    if (sale.annulee) return 'Annulée';
    if (!sale.estCredit) return 'Comptant';
    if (sale.creditRegle) return 'Réglé';
    if (this.isCreditEnRetard(sale)) return 'En retard';
    return 'Crédit';
  }

  // ==================== ACTIONS CARTE ====================

  toggleDetail(sale: VenteMap): void {
    this.selected = this.selected?.id === sale.id ? undefined : sale;
  }

  openDetailModal(sale: VenteMap): void {
    this.selectedVente = sale;
    this.showDetailModal = true;
  }

  openQrSaleModal(sale: VenteMap): void {
    this.selectedSaleForQr = sale;
    this.showQrSaleModal = true;
  }

  closeQrSaleModal(): void {
    this.showQrSaleModal = false;
    this.selectedSaleForQr = undefined;
  }

  // ==================== FACTURE PDF ====================

  private naviguerVersPdf(urlRelative: string): void {
    window.location.href = window.location.origin + urlRelative;
  }

  telechargerFactureVente(vente: VenteMap): void {
    this.presentToast('Préparation du PDF...', 'medium');
    this.factureService.obtenirFacturesParVente(vente.id).subscribe({
      next: factures => {
        if (factures.length > 0) {
          this.naviguerVersPdf(`/api/caisse/factures/${factures[0].id}/pdf`);
        } else {
          this.creerEtTelechargerFacture(vente, 'pdf');
        }
      },
      error: () => this.creerEtTelechargerFacture(vente, 'pdf')
    });
  }

  voirFactureVente(vente: VenteMap): void {
    this.presentToast('Préparation du PDF...', 'medium');
    this.factureService.obtenirFacturesParVente(vente.id).subscribe({
      next: factures => {
        if (factures.length > 0) {
          this.naviguerVersPdf(`/api/caisse/factures/${factures[0].id}/pdf/view`);
        } else {
          this.creerEtTelechargerFacture(vente, 'pdf/view');
        }
      },
      error: () => this.creerEtTelechargerFacture(vente, 'pdf/view')
    });
  }

  getQrCodeUrlSale(vente: VenteMap): void {
    this.qrSaleDataUrl = null;
    this.factureService.obtenirFacturesParVente(vente.id).subscribe({
      next: factures => {
        if (factures.length > 0) {
          this.selectedSaleForQr = { ...vente, factureId: factures[0].id } as any;
          this.showQrSaleModal = true;
          this.loadQrSaleImage(factures[0].id);
        } else {
          this.creerFacturePuisAfficherQr(vente);
        }
      },
      error: () => this.creerFacturePuisAfficherQr(vente)
    });
  }

  private creerFacturePuisAfficherQr(vente: VenteMap): void {
    const userId = this.auth.getUserId();
    this.factureService.creerFactureDepuisVente(vente.id, null, userId).subscribe({
      next: facture => {
        this.selectedSaleForQr = { ...vente, factureId: facture.id } as any;
        this.showQrSaleModal = true;
        this.loadQrSaleImage(facture.id);
      },
      error: err => this.presentToast(err.message || 'Impossible de créer la facture pour le QR', 'danger')
    });
  }

  private loadQrSaleImage(factureId: number): void {
    this.http.get(`/api/caisse/factures/${factureId}/qrcode`, { responseType: 'blob' }).subscribe({
      next: blob => {
        if (this.qrSaleBlobUrl) URL.revokeObjectURL(this.qrSaleBlobUrl);
        this.qrSaleBlobUrl = URL.createObjectURL(blob);
        this.qrSaleDataUrl = this.sanitizer.bypassSecurityTrustUrl(this.qrSaleBlobUrl);
      },
      error: () => { this.qrSaleDataUrl = null; }
    });
  }

  getQrCodeImgUrl(vente?: VenteMap): string {
    const id = (vente as any)?.factureId || vente?.id;
    return id ? `/api/caisse/factures/${id}/qrcode` : '';
  }

  telechargerQrVente(vente: VenteMap): void {
    const id = (vente as any)?.factureId || vente?.id;
    const link = document.createElement('a');
    link.href = `/api/caisse/factures/${id}/qrcode`;
    link.download = `qr-${vente.numeroVente}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private creerEtTelechargerFacture(vente: VenteMap, suffixe: string): void {
    const userId = this.auth.getUserId();
    this.factureService.creerFactureDepuisVente(vente.id, null, userId).subscribe({
      next: facture => this.naviguerVersPdf(`/api/caisse/factures/${facture.id}/${suffixe}`),
      error: err => this.presentToast(err.message || 'Impossible de générer la facture', 'danger')
    });
  }

  downloadPdfVente(saleId: number): void {
    this.naviguerVersPdf(`/api/caisse/factures/${saleId}/pdf`);
  }

  // ==================== CONFIRMATIONS POPUP ====================

  async confirmPrint(sale: VenteMap): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Télécharger la facture',
      message: `Imprimer la facture <strong>${sale.numeroVente}</strong> ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Imprimer',
          cssClass: 'alert-btn-primary',
          handler: () => {
            try {
              this.venteService.imprimerFacture(sale);
            } catch {
              this.presentToast('Activez les popups pour imprimer', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async confirmModify(sale: VenteMap): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Modifier la vente',
      subHeader: sale.numeroVente,
      message: `Total actuel : <strong>${this.money(sale.montantTotal)}</strong><br>Voulez-vous modifier cette vente ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Modifier',
          cssClass: 'alert-btn-warning',
          handler: () => this.doModify(sale)
        }
      ]
    });
    await alert.present();
  }

  async confirmCancel(sale: VenteMap): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: '⚠️ Annuler la vente',
      subHeader: `${sale.numeroVente} · ${this.money(sale.montantTotal)}`,
      message: 'Cette action est <strong>irréversible</strong>. Le stock sera remis à jour.',
      inputs: [{ name: 'motif', type: 'textarea', placeholder: 'Motif (optionnel)' }],
      buttons: [
        { text: 'Fermer', role: 'cancel' },
        {
          text: 'Confirmer l\'annulation',
          cssClass: 'alert-btn-danger',
          handler: data => {
            const req = sale.estCredit
              ? this.venteService.annulerVenteCredit(sale.id, data.motif)
              : this.venteService.annulerVente(sale.id, data.motif);
            req.subscribe({
              next: () => { this.presentToast('Vente annulée'); this.load(); },
              error: error => this.presentToast(error.message || 'Annulation impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  openStatsModal(): void {
    this.showStatsModal = true;
    if (!this.stats) {
      this.loadingStats = true;
      this.venteService.getStatistiquesChiffreAffaire().subscribe({
        next: stats => { this.stats = stats; this.loadingStats = false; },
        error: () => this.loadingStats = false
      });
    }
  }

  doModify(sale: VenteMap): void {
    this.venteAModifier = sale;
    this.modificationMotif = '';
    this.modifyLines = (sale.produits || []).map(p => ({
      produitId: p.produitId || 0,
      produitNom: p.produitNom,
      quantite: p.quantite,
      prixUnitaire: p.prixUnitaire,
      sousTotal: p.quantite * p.prixUnitaire,
      original: p
    }));
    this.showModifyModal = true;
  }

  onModifyProduitChange(index: number, produitId: number): void {
    const produit = this.produits.find(p => p.id === +produitId);
    if (produit) {
      this.modifyLines[index].produitId = produit.id;
      this.modifyLines[index].produitNom = produit.nom;
      this.modifyLines[index].prixUnitaire = produit.prixVente || 0;
      this.modifyLines[index].sousTotal = this.modifyLines[index].quantite * (produit.prixVente || 0);
    }
  }

  updateModifyLine(index: number): void {
    const line = this.modifyLines[index];
    line.sousTotal = line.quantite * line.prixUnitaire;
  }

  removeModifyLine(index: number): void {
    this.modifyLines.splice(index, 1);
  }

  addModifyLine(): void {
    this.modifyLines.push({ produitId: 0, produitNom: '', quantite: 1, prixUnitaire: 0, sousTotal: 0, original: null });
  }

  getModifyOldTotal(): number {
    return this.venteAModifier?.montantTotal || 0;
  }

  getModifyTotal(): number {
    return this.modifyLines.reduce((s, l) => s + l.sousTotal, 0);
  }

  getModifyDiff(): number {
    return this.getModifyTotal() - this.getModifyOldTotal();
  }

  async saveModify(): Promise<void> {
    if (!this.venteAModifier || !this.modifyLines.length) return;
    const invalid = this.modifyLines.filter(l => !l.produitId || l.quantite <= 0);
    if (invalid.length) {
      await this.presentToast('Sélectionnez un produit valide pour chaque ligne', 'danger');
      return;
    }
    const diff = this.getModifyDiff();
    const diffLabel = diff === 0
      ? 'Aucune différence de prix.'
      : diff > 0
        ? `+${this.money(diff)} → encaissement supplémentaire`
        : `${this.money(diff)} → remboursement au client`;
    const alert = await this.alertCtrl.create({
      header: 'Confirmer la modification',
      message: `
        Ancien total : <strong>${this.money(this.getModifyOldTotal())}</strong><br>
        Nouveau total : <strong>${this.money(this.getModifyTotal())}</strong><br>
        <span style="color:${diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b'}">${diffLabel}</span>
      `,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Enregistrer',
          cssClass: 'alert-btn-primary',
          handler: () => {
            const lignes = this.modifyLines.map(l => ({
              produitId: l.produitId,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire
            }));
            this.venteService.modifierLignesVente(this.venteAModifier!.id, lignes, this.modificationMotif || undefined).subscribe({
              next: () => {
                this.showModifyModal = false;
                this.presentToast('Vente modifiée ✓');
                this.load();
              },
              error: err => this.presentToast(err.message || 'Modification impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ==================== RETOUR VENTE ====================

  openRetourModal(vente: VenteMap): void {
    this.selectedVentePourRetour = vente;
    this.retourMotif = '';
    this.retourLignes = (vente.produits || []).map((p: any) => ({
      ligneVenteId: p.id || p.ligneVenteId,
      produitId: p.produitId || p.id,
      produitNom: p.produitNom || p.nom || 'Produit',
      prixUnitaire: p.prixApresRemise || p.prixUnitaire || 0,
      quantiteMax: p.quantite || 1,
      quantiteRetournee: p.quantite || 1,
      selected: true
    }));
    this.showRetourModal = true;
  }

  get totalRetour(): number {
    return this.retourLignes
      .filter(l => l.selected && l.quantiteRetournee > 0)
      .reduce((sum, l) => sum + l.quantiteRetournee * l.prixUnitaire, 0);
  }

  async submitRetour(): Promise<void> {
    const lignesSel = this.retourLignes.filter(l => l.selected && l.quantiteRetournee > 0);
    if (!lignesSel.length) {
      await this.presentToast('Sélectionnez au moins un produit à retourner', 'danger');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmer le retour ?',
      message: `Retour de <strong>${this.money(this.totalRetour)}</strong> pour la vente <strong>${this.selectedVentePourRetour?.numeroVente}</strong>.<br>Le stock et la caisse seront mis à jour.`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Valider le retour',
          cssClass: 'alert-btn-primary',
          handler: () => {
            let userId: number | undefined;
            try { const s = localStorage.getItem('currentUser'); if (s) userId = JSON.parse(s).id; } catch (e) {}
            const request: RetourVenteRequest = {
              venteId: this.selectedVentePourRetour!.id,
              motif: this.retourMotif || undefined,
              utilisateurId: userId,
              lignes: lignesSel.map(l => ({
                ligneVenteId: l.ligneVenteId,
                produitId: l.produitId,
                quantiteRetournee: l.quantiteRetournee,
                prixUnitaire: l.prixUnitaire
              }))
            };
            this.venteService.effectuerRetourVente(request).subscribe({
              next: () => {
                this.showRetourModal = false;
                this.presentToast(`Retour enregistré — ${this.money(this.totalRetour)} remboursé`);
                this.load();
              },
              error: err => this.presentToast(err.message || 'Retour impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  private async presentToast(message: string, color: 'success' | 'danger' | 'medium' | 'primary' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2400, position: 'top' });
    await toast.present();
  }
}
