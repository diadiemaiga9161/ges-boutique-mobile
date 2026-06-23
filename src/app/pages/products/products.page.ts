import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Categorie, Fournisseur, ProductService, Produit, ProduitRequest, StatistiquesStock } from '../../services/product.service';
import { WebSocketService } from '../../services/websocket.service';
import { BarcodeService } from '../../services/barcode.service';
import { StockAlertService } from '../../services/stock-alert.service';
import { FonctionnaliteService } from '../../services/fonctionnalite.service';
import { ProduitNiveau, ProduitNiveauService } from '../../services/produit-niveau.service';
import { OfflineDbService } from '../../services/offline-db.service';
import { SyncService } from '../../services/sync.service';

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
  loadingNiveaux = false;
  newNiveau: Partial<ProduitNiveau> = { nom: '', ordre: 1, facteur: 1, prixAchat: 0, prixVente: 0 };
  editingNiveauId: number | null = null;
  editNiveau: Partial<ProduitNiveau> = {};

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
    private offlineDb: OfflineDbService,
    private syncService: SyncService,
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

    const connected = await this.syncService.isConnected();

    if (!connected) {
      // Mode hors ligne
      if (this.editing) {
        await this.offlineDb.saveProduitUpdatePending(this.editing.id, this.form);
        this.presentToast('📡 Modification enregistrée hors ligne — sera synchronisée');
      } else {
        await this.offlineDb.saveProduitPending(this.form);
        this.presentToast('📡 Produit créé hors ligne — sera synchronisé');
      }
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
        // Fallback hors ligne si erreur réseau
        if (this.editing) {
          await this.offlineDb.saveProduitUpdatePending(this.editing.id, this.form);
          this.presentToast('📡 Modification enregistrée hors ligne');
        } else {
          await this.offlineDb.saveProduitPending(this.form);
          this.presentToast('📡 Produit créé hors ligne');
        }
        this.showForm = false;
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
    this.newNiveau = { nom: '', ordre: 1, facteur: 1, prixAchat: 0, prixVente: 0 };
    this.chargerNiveaux(product.id);
  }

  chargerNiveaux(produitId: number): void {
    this.loadingNiveaux = true;
    this.niveauService.getNiveaux(produitId).subscribe({
      next: niveaux => {
        this.niveaux = niveaux;
        this.loadingNiveaux = false;
        // Auto-set ordre pour le prochain niveau
        if (niveaux.length > 0) {
          this.newNiveau.ordre = Math.max(...niveaux.map(n => n.ordre)) + 1;
        }
      },
      error: () => {
        this.loadingNiveaux = false;
        this.presentToast('Chargement des niveaux impossible', 'danger');
      }
    });
  }

  ajouterNiveau(): void {
    if (!this.produitNiveaux || !this.newNiveau.nom?.trim()) {
      this.presentToast('Nom du niveau obligatoire', 'danger');
      return;
    }
    if (!this.newNiveau.facteur || this.newNiveau.facteur < 1) {
      this.presentToast('Facteur doit être >= 1', 'danger');
      return;
    }
    if (!this.newNiveau.prixVente || this.newNiveau.prixVente <= 0) {
      this.presentToast('Prix de vente obligatoire', 'danger');
      return;
    }
    this.niveauService.creer(this.produitNiveaux.id, this.newNiveau).subscribe({
      next: () => {
        this.presentToast('Niveau ajouté');
        this.chargerNiveaux(this.produitNiveaux!.id);
        this.newNiveau = {
          nom: '',
          ordre: (this.newNiveau.ordre || 1) + 1,
          facteur: 1,
          prixAchat: 0,
          prixVente: 0
        };
      },
      error: error => this.presentToast(error.message || 'Ajout impossible', 'danger')
    });
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
    this.editNiveau = { nom: niveau.nom, ordre: niveau.ordre, facteur: niveau.facteur, prixAchat: niveau.prixAchat, prixVente: niveau.prixVente };
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

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
