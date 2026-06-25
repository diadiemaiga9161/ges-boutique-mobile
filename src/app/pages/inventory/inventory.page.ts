import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { InventaireService, MouvementStock, ProduitStock, StatistiquesInventaire, TypeMouvement } from '../../services/inventaire.service';
import { Categorie, ProductService, Produit } from '../../services/product.service';
import { WebSocketService } from '../../services/websocket.service';
import { BarcodeService } from '../../services/barcode.service';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  standalone: false
})
export class InventoryPage {
  products: Produit[] = [];
  categories: Categorie[] = [];
  lowStock: ProduitStock[] = [];
  movements: MouvementStock[] = [];
  movementsFiltered: MouvementStock[] = [];
  stats?: StatistiquesInventaire;
  segment: 'move' | 'low' | 'history' = 'move';

  typeMouvement: TypeMouvement = TypeMouvement.ENTREE;
  loading = false;

  // Filtres mouvements
  searchTerm = '';
  typeMouvFilter = '';
  categorieFilter = '';
  dateDebut = '';
  dateFin = '';

  form = {
    produitId: 0,
    quantite: 1,
    nouvelleQuantite: 0,
    motif: '',
    searchProduit: ''
  };

  filteredProductsForForm: Produit[] = [];

  TypeMouvement = TypeMouvement;
  private wsSub?: Subscription;

  constructor(
    public inventory: InventaireService,
    private productsService: ProductService,
    private toastCtrl: ToastController,
    private ws: WebSocketService,
    private barcodeService: BarcodeService
  ) {}

  ionViewWillEnter(): void {
    this.ws.connect();
    this.wsSub = this.ws.subscribeTopic('/topic/stock').subscribe(event => {
      if (event?.data?.produitId != null && event?.data?.quantite != null) {
        const id = event.data.produitId;
        const qty = event.data.quantite;
        this.products = this.products.map(p => p.id === id ? { ...p, quantite: qty } : p);
        this.filteredProductsForForm = this.filteredProductsForForm.map(p => p.id === id ? { ...p, quantite: qty } : p);
        this.lowStock = this.lowStock
          .map(p => p.id === id ? { ...p, quantite: qty } : p)
          .filter(p => p.quantite <= p.seuilAlerte);
      }
    });
    this.load();
  }

  ionViewWillLeave(): void {
    this.wsSub?.unsubscribe();
    this.ws.unsubscribeTopic('/topic/stock');
  }

  load(event?: any): void {
    this.productsService.getProducts().subscribe(products => {
      this.products = products;
      this.filteredProductsForForm = products.slice(0, 20);
    });
    this.productsService.getAllCategories().subscribe(cats => this.categories = cats);
    this.inventory.obtenirProduitsStockFaible().subscribe(products => this.lowStock = products);
    this.inventory.obtenirStatistiquesInventaire().subscribe(stats => this.stats = stats);
    this.inventory.obtenirTousMouvements().subscribe({
      next: movements => {
        this.movements = movements;
        this.applyFilters();
        event?.target?.complete();
      },
      error: () => event?.target?.complete()
    });
  }

  applyFilters(): void {
    let filtered = [...this.movements];

    if (this.typeMouvFilter) {
      filtered = filtered.filter(m => m.typeMouvement === this.typeMouvFilter);
    }

    if (this.categorieFilter) {
      const produitsDeCat = this.products
        .filter(p => String(p.categorie?.id) === String(this.categorieFilter) || (p.categorie?.nom || '').toLowerCase().includes(this.categorieFilter.toLowerCase()))
        .map(p => p.nom);
      filtered = filtered.filter(m => produitsDeCat.includes(m.produit?.nom || ''));
    }

    if (this.dateDebut) {
      filtered = filtered.filter(m => m.dateMouvement >= this.dateDebut);
    }

    if (this.dateFin) {
      filtered = filtered.filter(m => {
        const d = (m.dateMouvement || '').split('T')[0];
        return d <= this.dateFin;
      });
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(m =>
        (m.produit?.nom || '').toLowerCase().includes(term) ||
        (m.motif || '').toLowerCase().includes(term) ||
        (m.utilisateur?.nomComplet || '').toLowerCase().includes(term)
      );
    }

    this.movementsFiltered = filtered;
  }

  resetFilters(): void {
    this.typeMouvFilter = '';
    this.categorieFilter = '';
    this.dateDebut = '';
    this.dateFin = '';
    this.searchTerm = '';
    this.applyFilters();
  }

  filterByPeriod(period: 'today' | 'week' | 'month'): void {
    const today = new Date();
    this.dateFin = today.toISOString().split('T')[0];

    if (period === 'today') {
      this.dateDebut = this.dateFin;
    } else if (period === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      this.dateDebut = d.toISOString().split('T')[0];
    } else {
      this.dateDebut = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    }
    this.applyFilters();
  }

  searchProductsForForm(): void {
    const term = (this.form.searchProduit || '').toLowerCase().trim();
    if (!term) {
      this.filteredProductsForForm = this.products.slice(0, 20);
      return;
    }
    const filtered = this.products.filter(p =>
      p.nom.toLowerCase().includes(term) || (p.codeBarre || '').toLowerCase().includes(term)
    );
    this.filteredProductsForForm = filtered.slice(0, 20);

    // Auto-sélection immédiate si code-barres exact (scanner physique USB/Bluetooth)
    const exact = filtered.find(p => (p.codeBarre || '').toLowerCase() === term);
    if (exact) {
      this.selectProduct(exact);
      this.presentToast(`✓ ${exact.nom}`, 'success');
    }
  }

  selectProduct(product: Produit): void {
    this.form.produitId = product.id;
    this.form.searchProduit = product.nom;
    this.form.nouvelleQuantite = product.quantite;
    this.filteredProductsForForm = [];
  }

  async scanProduit(): Promise<void> {
    const code = await this.barcodeService.scan();
    if (!code) return;

    // Recherche locale immédiate (sans attendre HTTP)
    const found = this.products.find(p =>
      (p.codeBarre || '').toLowerCase() === code.toLowerCase() ||
      p.nom.toLowerCase().includes(code.toLowerCase())
    );
    if (found) {
      this.selectProduct(found);
      this.presentToast(`✓ ${found.nom}`, 'success');
      return;
    }

    // Fallback API si pas trouvé localement
    this.productsService.getProductByCodeBarre(code).subscribe({
      next: produit => { this.selectProduct(produit); this.presentToast(`✓ ${produit.nom}`, 'success'); },
      error: () => this.presentToast(`Produit introuvable : ${code}`, 'danger')
    });
  }

  saveMovement(): void {
    if (!this.form.produitId || !this.form.motif.trim()) {
      this.presentToast('Produit et motif obligatoires', 'danger');
      return;
    }

    const request = this.typeMouvement === TypeMouvement.ENTREE
      ? this.inventory.entreeStock({ produitId: this.form.produitId, quantite: this.form.quantite, motif: this.form.motif })
      : this.typeMouvement === TypeMouvement.SORTIE
        ? this.inventory.sortieStock({ produitId: this.form.produitId, quantite: this.form.quantite, motif: this.form.motif })
        : this.inventory.ajusterStock({ produitId: this.form.produitId, nouvelleQuantite: this.form.nouvelleQuantite, motif: this.form.motif });

    request.subscribe({
      next: () => {
        this.presentToast('Stock mis à jour');
        this.form = { produitId: 0, quantite: 1, nouvelleQuantite: 0, motif: '', searchProduit: '' };
        this.load();
      },
      error: error => this.presentToast(error.message || 'Mouvement impossible', 'danger')
    });
  }

  getVariation(m: MouvementStock): string {
    const v = (m.quantiteApres || 0) - (m.quantiteAvant || 0);
    return v >= 0 ? `+${v}` : `${v}`;
  }

  isVariationPositive(m: MouvementStock): boolean {
    return (m.quantiteApres || 0) > (m.quantiteAvant || 0);
  }

  money(value: number): string {
    return this.inventory.formatPrice(value);
  }

  getTypeLabel(type: string): string {
    return this.inventory.getTypeMouvementLabel(type as TypeMouvement);
  }

  getTypeClass(type: string): string {
    return this.inventory.getTypeMouvementClass(type as TypeMouvement);
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
