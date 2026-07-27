import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Categorie, Fournisseur, ProductService, Produit, ProduitRequest, StatistiquesStock } from '../../services/product.service';
import { WebSocketService } from '../../services/websocket.service';
import { BoutiqueService } from '../../services/boutique.service';
import { BarcodeService } from '../../services/barcode.service';
import { StockAlertService } from '../../services/stock-alert.service';
import { FonctionnaliteService } from '../../services/fonctionnalite.service';
import { ProduitNiveau, ProduitNiveauService } from '../../services/produit-niveau.service';
import { OfflineSyncService } from '../../services/offline-sync.service';
import { NetworkStatusService } from '../../services/network-status.service';

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
  standalone: false,
})
export class ProductsPage implements OnInit {
  private wsSub?: Subscription;
  products: Produit[] = [];
  allProducts: Produit[] = [];
  categories: Categorie[] = [];
  fournisseurs: Fournisseur[] = [];
  filtered: Produit[] = [];
  stats?: StatistiquesStock;
  query = '';
  segment: 'all' | 'low' | 'expired' | 'bio' = 'all';
  selectedCategorieId: number | null = null;
  loading = false;
  trackById = (_: number, item: any) => item.id;
  showForm = false;
  showStatsModal = false;
  showCategoriesModal = false;
  editing?: Produit;

  form: ProduitRequest = this.emptyForm();
  categoryName = '';
  editingCategoryId?: number;
  editingCategoryName = '';

  // Conditionnement
  conditionnementActif = false;
  showNiveauxModal = false;
  produitNiveaux: Produit | null = null;
  niveaux: ProduitNiveau[] = [];
  niveauxChaine: ProduitNiveau[] = [];
  loadingNiveaux = false;
  newNiveau: Partial<ProduitNiveau> & { parentId: number | null } = { nom: '', parentId: null, facteur: 1, prixAchat: 0, prixVente: 0, stock: 0 };
  editingNiveauId: number | null = null;
  editNiveau: Partial<ProduitNiveau> = {};
  showAjoutNiveauModal = false;

  constructor(
    public productsService: ProductService,
    public auth: AuthService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private ws: WebSocketService,
    private barcodeService: BarcodeService,
    private stockAlert: StockAlertService,
    private fonctionnalite: FonctionnaliteService,
    private niveauService: ProduitNiveauService,
    private offlineSync: OfflineSyncService,
    private networkStatus: NetworkStatusService,
    private boutiqueService: BoutiqueService
  ) {}

  async scanCodeBarre(): Promise<void> {
    const code = await this.barcodeService.scan();
    if (code) this.form.codeBarre = code;
  }

  ngOnInit() {
    this.stockAlert.requestPermission();
    this.conditionnementActif = this.fonctionnalite.isConditionnementActif();
    this.load();
  }

  ionViewWillEnter(): void {
    this.conditionnementActif = this.fonctionnalite.isConditionnementActif();
    this.ws.connect();
    this.wsSub = this.ws.subscribeTopic('/topic/stock').subscribe(event => {
      if (event?.data?.produitId != null && event?.data?.quantite != null) {
        const id = event.data.produitId;
        const qty = event.data.quantite;
        this.allProducts = this.allProducts.map(p => p.id === id ? { ...p, quantite: qty } : p);
        this.applyFilter();
      }
    });
  }

  ionViewWillLeave(): void {
    this.wsSub?.unsubscribe();
    this.ws.unsubscribeTopic('/topic/stock');
  }

  load(event?: any): void {
    this.loading = true;
    this.productsService.getProducts().subscribe({
      next: products => {
        this.allProducts = products;
        this.applyFilter();
        this.loading = false;
        event?.target?.complete();
        this.stockAlert.verifierStock(products);
      },
      error: error => {
        this.loading = false;
        event?.target?.complete();
        this.presentToast(error.message || 'Chargement impossible', 'danger');
      }
    });

    this.productsService.getAllCategories().subscribe(categories => this.categories = categories);
    this.productsService.getAllFournisseurs().subscribe(fournisseurs => this.fournisseurs = fournisseurs);

    if (this.auth.isAdmin()) {
      this.productsService.getStockStatistics().subscribe(stats => this.stats = stats);
    }
  }

  search(): void {
    if (!this.query.trim()) {
      this.applyFilter();
      return;
    }

    this.productsService.searchProducts(this.query).subscribe({
      next: products => {
        this.allProducts = products;
        this.applyFilter();
      },
      error: error => this.presentToast(error.message || 'Recherche impossible', 'danger')
    });
  }

  applyFilter(): void {
    const term = this.query.trim().toLowerCase();
    let result = [...this.allProducts];

    if (this.selectedCategorieId) {
      result = result.filter(p => p.categorie?.id === this.selectedCategorieId || p.categorieId === this.selectedCategorieId);
    }

    switch (this.segment) {
      case 'low': result = result.filter(p => p.stockFaible || p.quantite <= p.seuilAlerte); break;
      case 'expired': result = result.filter(p => p.perime || p.prochePeremption); break;
      case 'bio': result = result.filter(p => p.bio); break;
    }

    if (term) {
      result = result.filter(p => [p.nom, p.codeBarre, p.categorieNom, p.categorie?.nom, p.fournisseur?.nom]
        .filter(Boolean).some(v => `${v}`.toLowerCase().includes(term)));
    }

    this.filtered = result;
  }

  startCreate(): void {
    this.editing = undefined;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  startEdit(product: Produit): void {
    this.editing = product;
    this.form = {
      nom: product.nom,
      description: product.description || '',
      categorieId: product.categorieId || product.categorie?.id || 0,
      fournisseurId: product.fournisseurId || product.fournisseur?.id,
      prixAchat: product.prixAchat,
      prixVente: product.prixVente,
      quantite: product.quantite,
      seuilAlerte: product.seuilAlerte,
      codeBarre: product.codeBarre || '',
      datePeremption: product.datePeremption || '',
      bio: !!product.bio,
      typeVente: product.typeVente || 'UNITE'
    };
    this.showForm = true;
  }

  async save(): Promise<void> {
    if (!this.form.nom.trim()) {
      this.presentToast('Le nom est obligatoire', 'danger');
      return;
    }
    if (this.form.prixVente <= 0) {
      this.presentToast('Le prix de vente doit être supérieur à 0', 'danger');
      return;
    }

    const endpoint = this.editing ? `/api/produits/${this.editing.id}` : '/api/produits';

    if (!this.networkStatus.isOnline()) {
      // Mode hors ligne
      await this.offlineSync.addOfflineAction(
        this.editing ? 'PRODUIT_UPDATE' : 'PRODUIT_CREATE',
        endpoint,
        this.editing ? 'PUT' : 'POST',
        this.form
      );
      this.presentToast(this.editing ? '📡 Modification enregistrée hors ligne — sera synchronisée' : '📡 Produit créé hors ligne — sera synchronisé');
      this.showForm = false;
      return;
    }

    const request = this.editing
      ? this.productsService.updateProduct(this.editing.id, this.form)
      : this.productsService.createProduct(this.form);

    request.subscribe({
      next: () => {
        this.presentToast(this.editing ? 'Produit modifié' : 'Produit créé');
        this.showForm = false;
        this.load();
      },
      error: async error => {
        if (error.status === 0) {
          // Vraie perte de connexion — mettre en file d'attente
          await this.offlineSync.addOfflineAction(
            this.editing ? 'PRODUIT_UPDATE' : 'PRODUIT_CREATE',
            endpoint,
            this.editing ? 'PUT' : 'POST',
            this.form
          );
          this.presentToast(this.editing ? '📡 Modification enregistrée hors ligne' : '📡 Produit créé hors ligne');
          this.showForm = false;
          return;
        }
        // Vraie erreur serveur (validation, doublon...) — ne pas la faire passer pour du hors ligne
        const message = error?.error?.message || (this.editing ? 'Erreur lors de la modification du produit' : 'Erreur lors de la création du produit');
        this.presentToast(message, 'danger');
      }
    });
  }

  async confirmDelete(product: Produit): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer le produit',
      message: `${product.nom} sera supprimé définitivement. Stock: ${product.quantite}`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          role: 'destructive',
          handler: () => this.delete(product)
        }
      ]
    });
    await alert.present();
  }

  createCategory(): void {
    if (!this.categoryName.trim()) return;
    this.productsService.createCategory({ nom: this.categoryName.trim() }).subscribe({
      next: category => {
        this.categories = [...this.categories, category];
        this.form.categorieId = category.id;
        this.categoryName = '';
        this.presentToast('Catégorie créée');
      },
      error: error => this.presentToast(error.message || 'Création catégorie impossible', 'danger')
    });
  }

  startEditCategory(cat: Categorie): void {
    this.editingCategoryId = cat.id;
    this.editingCategoryName = cat.nom;
  }

  saveEditCategory(): void {
    if (!this.editingCategoryId || !this.editingCategoryName.trim()) return;
    this.productsService.updateCategory(this.editingCategoryId, { nom: this.editingCategoryName.trim() }).subscribe({
      next: updated => {
        this.categories = this.categories.map(c => c.id === updated.id ? updated : c);
        this.editingCategoryId = undefined;
        this.editingCategoryName = '';
        this.presentToast('Catégorie modifiée');
      },
      error: error => this.presentToast(error.message || 'Modification impossible', 'danger')
    });
  }

  async confirmDeleteCategory(cat: Categorie): Promise<void> {
    const count = this.countByCategorie(cat.id);
    const alert = await this.alertCtrl.create({
      header: 'Supprimer la catégorie',
      message: count > 0
        ? `Cette catégorie contient ${count} produit(s). Supprimer quand même ?`
        : `Supprimer "${cat.nom}" ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', role: 'destructive', cssClass: 'alert-btn-danger',
          handler: () => {
            this.productsService.deleteCategory(cat.id).subscribe({
              next: () => {
                this.categories = this.categories.filter(c => c.id !== cat.id);
                this.presentToast('Catégorie supprimée');
              },
              error: error => this.presentToast(error.message || 'Suppression impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ==================== CONDITIONNEMENT ====================

  ouvrirNiveaux(product: Produit): void {
    this.produitNiveaux = product;
    this.showNiveauxModal = true;
    this.resetNewNiveau();
    this.chargerNiveaux(product.id);
  }

  ouvrirAjoutNiveau(): void {
    this.resetNewNiveau();
    this.showAjoutNiveauModal = true;
  }

  resetNewNiveau(): void {
    this.newNiveau = { nom: '', parentId: null, facteur: 1, prixAchat: 0, prixVente: 0, stock: 0 };
  }

  get labelFacteur(): string {
    if (this.newNiveau.parentId) {
      const parent = this.niveaux.find(n => n.id === this.newNiveau.parentId);
      return `Quantité dans 1 ${parent?.nom || 'unité parent'}`;
    }
    const nomProduit = this.produitNiveaux?.nom || 'produit';
    return `Quantité dans 1 ${nomProduit}`;
  }

  onParentChange(): void {
    this.newNiveau.facteur = this.newNiveau.facteur && this.newNiveau.facteur >= 1 ? this.newNiveau.facteur : 1;
  }

  chargerNiveaux(produitId: number): void {
    this.loadingNiveaux = true;
    this.niveauService.getNiveaux(produitId).subscribe({
      next: niveaux => {
        this.niveaux = niveaux;
        this.niveauxChaine = this.niveauService.buildNiveauxChaine(niveaux);
        this.loadingNiveaux = false;
      },
      error: () => {
        this.loadingNiveaux = false;
        this.presentToast('Chargement des niveaux impossible', 'danger');
      }
    });
  }

  ajouterNiveau(): void {
    if (!this.produitNiveaux || !this.newNiveau.nom?.trim()) {
      this.presentToast('Nom de l\'emballage obligatoire', 'danger');
      return;
    }
    if (!this.newNiveau.facteur || Number(this.newNiveau.facteur) < 1) {
      this.presentToast('La quantité doit être >= 1', 'danger');
      return;
    }
    if (!this.newNiveau.prixVente || this.newNiveau.prixVente <= 0) {
      this.presentToast('Prix de vente obligatoire', 'danger');
      return;
    }
    const parentIdValue = this.newNiveau.parentId ? Number(this.newNiveau.parentId) : null;
    const payload: Partial<ProduitNiveau> = {
      nom: this.newNiveau.nom?.trim(),
      parentId: parentIdValue as any,
      facteur: Math.max(1, Number(this.newNiveau.facteur) || 1),
      prixAchat: Number(this.newNiveau.prixAchat) || 0,
      prixVente: Number(this.newNiveau.prixVente) || 0,
      stock: Number(this.newNiveau.stock) || 0,
    };
    this.niveauService.creer(this.produitNiveaux.id, payload).subscribe({
      next: () => {
        this.presentToast('Niveau ajouté');
        this.showAjoutNiveauModal = false;
        this.chargerNiveaux(this.produitNiveaux!.id);
        this.resetNewNiveau();
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Erreur lors de la création du niveau';
        this.presentToast(msg, 'danger');
      }
    });
  }

  decomposerNiveau(niveau: ProduitNiveau): void {
    const parentNom = this.niveauService.nomParent(niveau, this.niveaux);
    this.niveauService.decomposer(niveau.id!).subscribe({
      next: result => {
        this.presentToast(result.message || `1 ${parentNom || niveau.nom} ouvert`);
        this.chargerNiveaux(this.produitNiveaux!.id);
      },
      error: e => this.presentToast(e.message || 'Ouverture impossible', 'danger')
    });
  }

  nomParentNiveau(niveau: ProduitNiveau): string {
    return this.niveauService.nomParent(niveau, this.niveaux);
  }

  labelFacteurNiveau(niveau: ProduitNiveau): string {
    return this.niveauService.labelFacteur(niveau, this.niveaux);
  }

  // Retourne l'enfant direct d'un niveau (pour bouton "Ouvrir")
  niveauEnfantDirect(parentId?: number): ProduitNiveau | null {
    if (!parentId) return null;
    return this.niveaux.find(n => n.parentId === parentId) || null;
  }

  // Badge coloré de stock par niveau (ok/bas/rupture).
  // NB: ProduitNiveau n'a pas de seuil d'alerte propre côté backend ;
  // on applique un seuil visuel conservateur (3 unités) uniquement pour l'affichage.
  niveauStockClass(niveau: ProduitNiveau): 'ok' | 'bas' | 'rupture' {
    const stock = niveau.stock ?? 0;
    if (stock <= 0) return 'rupture';
    if (stock <= 3) return 'bas';
    return 'ok';
  }

  ajusterStockNiveau(niveau: ProduitNiveau, stock: number): void {
    if (stock == null || stock < 0) return;
    this.niveauService.ajusterStock(niveau.id!, stock).subscribe({
      next: updated => {
        const idx = this.niveaux.findIndex(n => n.id === niveau.id);
        if (idx >= 0) this.niveaux[idx] = { ...this.niveaux[idx], stock: updated.stock };
        this.presentToast(`Stock ${niveau.nom} mis à jour : ${updated.stock}`);
      },
      error: e => this.presentToast(e.message || 'Ajustement impossible', 'danger')
    });
  }

  startEditNiveau(niveau: ProduitNiveau): void {
    this.editingNiveauId = niveau.id!;
    this.editNiveau = {
      nom: niveau.nom,
      parentId: niveau.parentId,
      facteur: niveau.facteur,
      prixAchat: niveau.prixAchat,
      prixVente: niveau.prixVente,
      stock: niveau.stock
    };
  }

  cancelEditNiveau(): void {
    this.editingNiveauId = null;
    this.editNiveau = {};
  }

  saveEditNiveau(): void {
    if (!this.editingNiveauId) return;
    this.niveauService.modifier(this.editingNiveauId, this.editNiveau).subscribe({
      next: () => {
        this.presentToast('Niveau modifié');
        this.editingNiveauId = null;
        this.editNiveau = {};
        this.chargerNiveaux(this.produitNiveaux!.id);
      },
      error: e => this.presentToast(e.message || 'Modification impossible', 'danger')
    });
  }

  async supprimerNiveau(niveau: ProduitNiveau): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer niveau',
      message: `Supprimer "${niveau.nom}" ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', role: 'destructive',
          handler: () => {
            this.niveauService.supprimer(niveau.id!).subscribe({
              next: () => {
                this.niveaux = this.niveaux.filter(n => n.id !== niveau.id);
                this.presentToast('Niveau supprimé');
              },
              error: error => this.presentToast(error.message || 'Suppression impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ==================== UTILITAIRES ====================

  getStockClass(product: Produit): string {
    if (product.quantite <= 0) return 'danger';
    if (product.stockFaible) return 'warning';
    return 'success';
  }

  getStockText(product: Produit): string {
    if (product.quantite <= 0) return 'Rupture';
    if (product.stockFaible) return 'Faible';
    return 'OK';
  }

  money(value: number): string {
    return this.productsService.formatPrice(value);
  }

  countByCategorie(categorieId: number): number {
    return this.allProducts.filter(p => p.categorieId === categorieId || p.categorie?.id === categorieId).length;
  }

  private delete(product: Produit): void {
    this.productsService.deleteProduct(product.id).subscribe({
      next: () => {
        this.presentToast('Produit supprimé');
        this.load();
      },
      error: error => this.presentToast(error.message || 'Suppression impossible', 'danger')
    });
  }

  private emptyForm(): ProduitRequest {
    return {
      nom: '',
      description: '',
      categorieId: 0,
      prixAchat: 0,
      prixVente: 0,
      quantite: 0,
      seuilAlerte: 10,
      codeBarre: '',
      bio: false,
      typeVente: 'UNITE'
    };
  }

  telechargerStockPdf(): void {
    const shop = this.boutiqueService.getInfo();
    const date = new Date().toLocaleDateString('fr-FR');
    const liste = this.filtered.length ? this.filtered : this.allProducts;
    const totalArticles = liste.reduce((s, p) => s + (p.quantite || 0), 0);
    const valeurTotale = liste.reduce((s, p) => s + (p.quantite || 0) * (p.prixAchat || 0), 0);

    const qrData = encodeURIComponent('Stock ' + (shop.nom || '') + ' ' + date + ' ' + liste.length + ' produits');
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=' + qrData;

    const lignes = liste.map((p, i) => {
      const stockColor = p.quantite <= 0 ? '#ef4444' : (p.stockFaible ? '#d97706' : '#16a34a');
      const stockLabel = p.quantite <= 0 ? 'Rupture' : (p.stockFaible ? 'Faible' : 'OK');
      return '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f8fafc') + '">' +
        '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">' + p.nom + '</td>' +
        '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">' + (p.categorieNom || p.categorie?.nom || '—') + '</td>' +
        '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:center">' +
        '<span style="background:' + stockColor + '22;color:' + stockColor + ';border-radius:4px;padding:2px 8px;font-weight:700;font-size:11px">' + (p.quantite || 0) + ' · ' + stockLabel + '</span>' +
        '</td>' +
        '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right">' + this.money(p.prixAchat || 0) + '</td>' +
        '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700">' + this.money(p.prixVente || 0) + '</td>' +
        '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;color:#1d4ed8">' + this.money((p.quantite || 0) * (p.prixAchat || 0)) + '</td>' +
        '</tr>';
    }).join('');

    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Stock Produits</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f4f8;padding:24px;font-size:13px;color:#1e293b}' +
      '.sheet{background:#fff;max-width:960px;margin:0 auto;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}' +
      '.hdr{background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start}' +
      '.hdr h1{font-size:22px;font-weight:900;margin-bottom:4px}.hdr p{font-size:12px;opacity:.75;margin-top:3px}' +
      '.body{padding:24px 32px}' +
      '.kpis{display:flex;gap:12px;margin-bottom:20px}' +
      '.kpi{flex:1;border-radius:10px;padding:14px 16px;text-align:center}' +
      '.kpi-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:.75;margin-bottom:4px}' +
      '.kpi-val{font-size:18px;font-weight:900}' +
      '.kpi--blue{background:#dbeafe;color:#1d4ed8}.kpi--slate{background:#f1f5f9;color:#475569}.kpi--green{background:#dcfce7;color:#15803d}' +
      'table{width:100%;border-collapse:collapse}thead tr{background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff}' +
      'thead th{padding:9px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left;border:1px solid rgba(255,255,255,.1)}' +
      '.ftr{background:#eff6ff;padding:14px 32px;font-size:11px;color:#1e40af;text-align:center}' +
      '.btn-bar{display:flex;gap:8px;margin-bottom:16px}' +
      '.btn-print{background:#1d4ed8;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}' +
      '.btn-close{background:#64748b;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}' +
      '@media print{.btn-bar{display:none}body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}' +
      '</style></head><body>' +
      '<div class="sheet">' +
      '<div class="hdr"><div><h1>Stock Produits</h1><p>' + (shop.nom || 'Ges Boutique') + '</p><p>Genere le ' + date + '</p></div>' +
      '<div style="text-align:right"><img src="' + qrUrl + '" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px" alt="QR"></div></div>' +
      '<div class="body">' +
      '<div class="btn-bar"><button class="btn-print" onclick="window.print()">Imprimer / PDF</button><button class="btn-close" onclick="window.close()">Fermer</button></div>' +
      '<div class="kpis">' +
      '<div class="kpi kpi--blue"><div class="kpi-lbl">Produits</div><div class="kpi-val">' + liste.length + '</div></div>' +
      '<div class="kpi kpi--slate"><div class="kpi-lbl">Total articles</div><div class="kpi-val">' + totalArticles + '</div></div>' +
      '<div class="kpi kpi--green"><div class="kpi-lbl">Valeur stock</div><div class="kpi-val">' + this.money(valeurTotale) + '</div></div>' +
      '</div>' +
      (liste.length ? '<table><thead><tr><th>Produit</th><th>Categorie</th><th style="text-align:center">Stock</th><th style="text-align:right">P. Achat</th><th style="text-align:right">P. Vente</th><th style="text-align:right">Valeur</th></tr></thead><tbody>' + lignes + '</tbody></table>' : '<p style="text-align:center;color:#64748b;padding:24px">Aucun produit</p>') +
      '</div><div class="ftr">' + (shop.nom || 'Ges Boutique') + ' · Stock · ' + date + ' · ' + liste.length + ' produit(s)</div></div>' +
      '</body></html>';

    this.openLocalOverlay(html);
  }

  private openLocalOverlay(html: string): void {
    document.getElementById('products-pdf-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'products-pdf-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:rgba(0,0,0,.65)';
    const btnFloat = document.createElement('button');
    btnFloat.textContent = '✕';
    btnFloat.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:12px;background:rgba(0,0,0,.75);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:20px;font-weight:700;cursor:pointer;z-index:2;line-height:1';
    btnFloat.addEventListener('click', () => overlay.remove());
    overlay.appendChild(btnFloat);
    const frame = document.createElement('iframe');
    frame.style.cssText = 'flex:1;width:100%;border:none;background:#f0f4f8';
    frame.setAttribute('srcdoc', html);
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#1d4ed8;padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap';
    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fermer';
    btnClose.style.cssText = 'background:#fff;color:#1d4ed8;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
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
