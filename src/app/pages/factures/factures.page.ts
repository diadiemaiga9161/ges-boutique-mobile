import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ToastController, AlertController } from '@ionic/angular';
import { FactureService, Facture, FactureRequest, LigneFactureRequest } from '../../services/facture.service';
import { AuthService } from '../../services/auth.service';
import { ProductService, Produit } from '../../services/product.service';
import { FactureDesignService, DesignFacture } from '../../services/facture-design.service';
import { BoutiqueConfigService } from '../../services/boutique-config.service';

@Component({
  selector: 'app-factures',
  templateUrl: './factures.page.html',
  styleUrls: ['./factures.page.scss'],
  standalone: false
})
export class FacturesPage {

  factures: Facture[] = [];
  filtered: Facture[] = [];
  searchTerm = '';
  filterStatut = '';
  loading = false;

  // Design actif
  design: DesignFacture = 1;

  // Statistiques
  get totalMontant(): number { return this.factures.reduce((s, f) => s + (f.montantTotal || 0), 0); }
  get nbBrouillons(): number { return this.factures.filter(f => f.statut === 'BROUILLON').length; }
  get nbValides(): number { return this.factures.filter(f => f.statut === 'VALIDE').length; }
  get nbPayees(): number { return this.factures.filter(f => f.statut === 'PAYEE').length; }

  // Modal détail
  showDetailModal = false;
  selectedFacture?: Facture;

  // QR code blob SafeUrl
  qrDataUrl: SafeUrl | null = null;
  qrLoading = false;

  // Modal QR (standalone)
  showQrModal = false;
  factureForQr?: Facture;

  // Modal pro forma (création directe)
  showCreateModal = false;
  proformaForm = { clientNom: '', clientTelephone: '', notes: '' };
  proformaLignes: Array<{ designation: string; quantite: number; prixUnitaire: number }> = [];
  proformaNewLine = { designation: '', quantite: 1, prixUnitaire: 0 };
  proformaCreating = false;

  // Recherche catalogue produits
  produits: Produit[] = [];
  produitSearch = '';
  showProduitSearch = false;

  get filteredProduits(): Produit[] {
    const t = this.produitSearch.trim().toLowerCase();
    if (!t) return this.produits.slice(0, 20);
    return this.produits.filter(p =>
      p.nom.toLowerCase().includes(t) ||
      (p.codeBarre && p.codeBarre.includes(t))
    ).slice(0, 20);
  }

  get proformaTotal(): number {
    return this.proformaLignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);
  }

  get boutiqueName(): string {
    return this.boutiqueConfig.getBoutiqueName() || 'Ma Boutique';
  }

  constructor(
    public auth: AuthService,
    private factureService: FactureService,
    private productService: ProductService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private designService: FactureDesignService,
    private boutiqueConfig: BoutiqueConfigService,
    private http: HttpClient,
    private sanitizer: DomSanitizer
  ) {}

  ionViewWillEnter(): void {
    this.design = this.designService.getDesign();
    this.load();
  }

  load(event?: any): void {
    this.loading = true;
    this.factureService.obtenirToutesFactures().subscribe({
      next: list => {
        this.factures = list.sort((a, b) =>
          new Date(b.dateCreation).getTime() - new Date(a.dateCreation).getTime()
        );
        this.applyFilter();
        this.loading = false;
        event?.target?.complete();
      },
      error: err => {
        this.loading = false;
        event?.target?.complete();
        this.toast(err.message || 'Chargement impossible', 'danger');
      }
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.filtered = this.factures.filter(f => {
      const matchStatut = !this.filterStatut || f.statut === this.filterStatut;
      const matchSearch = !term ||
        f.numeroFacture.toLowerCase().includes(term) ||
        (f.clientNom || '').toLowerCase().includes(term) ||
        (f.clientTelephone || '').toLowerCase().includes(term);
      return matchStatut && matchSearch;
    });
  }

  setFilterStatut(s: string): void {
    this.filterStatut = this.filterStatut === s ? '' : s;
    this.applyFilter();
  }

  // ── Détail ──────────────────────────────────────────────
  openDetail(f: Facture): void {
    this.selectedFacture = f;
    this.qrDataUrl = null;
    this.showDetailModal = true;
    this.loadQrBlob(f.id);
  }

  closeDetail(): void {
    this.showDetailModal = false;
    this.selectedFacture = undefined;
    this.qrDataUrl = null;
  }

  // Charge le QR via blob pour fonctionner dans Capacitor
  private loadQrBlob(factureId: number): void {
    this.qrLoading = true;
    const token = this.auth.getToken() || '';
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    this.http.get(`/api/caisse/factures/${factureId}/qrcode`, { headers, responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        this.qrDataUrl = this.sanitizer.bypassSecurityTrustUrl(url);
        this.qrLoading = false;
      },
      error: () => { this.qrLoading = false; }
    });
  }

  // ── PDF ─────────────────────────────────────────────────
  telechargerPdf(f: Facture): void {
    this.toast('Préparation...', 'medium');
    if (f.lignes?.length > 0) {
      this.factureService.imprimerFacture(f);
    } else {
      this.factureService.obtenirFacture(f.id).subscribe({
        next: full => this.factureService.imprimerFacture(full),
        error: () => { window.location.href = window.location.origin + `/api/caisse/factures/${f.id}/pdf`; }
      });
    }
  }

  // ── QR modal standalone ──────────────────────────────────
  ouvrirQr(f: Facture): void { this.factureForQr = f; this.showQrModal = true; }
  fermerQr(): void { this.showQrModal = false; this.factureForQr = undefined; }

  getQrUrl(f?: Facture): string {
    return f ? `/api/caisse/factures/${f.id}/qrcode` : '';
  }

  // ── Statut (Admin) ───────────────────────────────────────
  async changerStatut(f: Facture, statut: string): Promise<void> {
    const labels: Record<string, string> = { VALIDE: 'Valider', PAYEE: 'Marquer payée', ANNULEE: 'Annuler' };
    const alert = await this.alertCtrl.create({
      header: 'Confirmer',
      message: `${labels[statut] || statut} la facture ${f.numeroFacture} ?`,
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui', handler: () => {
            const obs = statut === 'VALIDE'
              ? this.factureService.validerFacture(f.id)
              : statut === 'ANNULEE'
                ? this.factureService.annulerFacture(f.id)
                : this.factureService.validerFacture(f.id);
            obs.subscribe({
              next: updated => {
                const idx = this.factures.findIndex(x => x.id === f.id);
                if (idx !== -1) this.factures[idx] = updated;
                this.applyFilter();
                if (this.selectedFacture?.id === f.id) this.selectedFacture = updated;
                this.toast('Statut mis à jour');
              },
              error: err => this.toast(err.message || 'Erreur', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ── Création pro forma ───────────────────────────────────
  openCreateModal(): void {
    this.proformaForm = { clientNom: '', clientTelephone: '', notes: '' };
    this.proformaLignes = [];
    this.proformaNewLine = { designation: '', quantite: 1, prixUnitaire: 0 };
    this.produitSearch = '';
    this.showProduitSearch = false;
    this.proformaCreating = false;
    this.showCreateModal = true;
    if (!this.produits.length) {
      this.productService.getProducts().subscribe({
        next: p => { this.produits = p; },
        error: () => {}
      });
    }
  }

  selectProduitProforma(p: Produit): void {
    this.proformaNewLine.designation = p.nom;
    this.proformaNewLine.prixUnitaire = p.prixVente;
    this.produitSearch = p.nom;
    this.showProduitSearch = false;
  }

  addProformaLine(): void {
    if (!this.proformaNewLine.designation.trim() || this.proformaNewLine.prixUnitaire <= 0) {
      this.toast('Désignation et prix requis', 'danger');
      return;
    }
    this.proformaLignes.push({ ...this.proformaNewLine });
    this.proformaNewLine = { designation: '', quantite: 1, prixUnitaire: 0 };
  }

  removeProformaLine(i: number): void {
    this.proformaLignes.splice(i, 1);
  }

  submitProforma(): void {
    if (!this.proformaLignes.length) {
      this.toast('Ajoutez au moins un article', 'danger');
      return;
    }
    this.proformaCreating = true;
    const request: FactureRequest = {
      clientNom: this.proformaForm.clientNom.trim() || undefined,
      clientTelephone: this.proformaForm.clientTelephone.trim() || undefined,
      notes: this.proformaForm.notes.trim() || undefined,
      utilisateurId: this.auth.getUserId(),
      lignes: this.proformaLignes.map(l => ({
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire
      } as LigneFactureRequest))
    };
    this.factureService.creerFacture(request).subscribe({
      next: facture => {
        this.factures.unshift(facture);
        this.applyFilter();
        this.showCreateModal = false;
        this.proformaCreating = false;
        this.toast(`Facture ${facture.numeroFacture} créée`);
      },
      error: err => {
        this.proformaCreating = false;
        this.toast(err.message || 'Impossible de créer la facture', 'danger');
      }
    });
  }

  // ── Utilitaires ─────────────────────────────────────────
  money(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(v || 0);
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  statutLabel(s: string): string {
    return ({ BROUILLON: 'Brouillon', VALIDE: 'Validée', PAYEE: 'Payée', ANNULEE: 'Annulée' } as any)[s] || s;
  }

  statutColor(s: string): string {
    return ({ BROUILLON: 'medium', VALIDE: 'primary', PAYEE: 'success', ANNULEE: 'danger' } as any)[s] || 'medium';
  }

  private async toast(message: string, color: 'success' | 'danger' | 'medium' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await t.present();
  }
}
