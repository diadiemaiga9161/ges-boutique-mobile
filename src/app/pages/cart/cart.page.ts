import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Client, ClientService } from '../../services/client.service';
import { ProductService, Produit } from '../../services/product.service';
import { ModePaiement, RemiseType, VenteService } from '../../services/vente.service';
import { BarcodeService } from '../../services/barcode.service';
import { Promotion, PromotionService } from '../../services/promotion.service';
import { FonctionnaliteService } from '../../services/fonctionnalite.service';
import { ProduitNiveau, ProduitNiveauService } from '../../services/produit-niveau.service';

interface CartItem {
  product: Produit;
  quantity: number;
  remisePourcentage: number;
  customPrice: number;
  editingPrice: boolean;
  promo?: Promotion;        // promo active appliquée sur ce produit
  prixOriginal?: number;    // prix avant promo
  niveauPrixAchat?: number; // prix achat du niveau (conditionnement)
  niveauNom?: string;       // nom du niveau choisi
}

@Component({
  selector: 'app-cart',
  templateUrl: './cart.page.html',
  styleUrls: ['./cart.page.scss'],
  standalone: false,
})
export class CartPage implements OnInit {
  products: Produit[] = [];
  filteredProducts: Produit[] = [];
  clients: Client[] = [];
  items: CartItem[] = [];
  query = '';
  clientSearch = '';
  clientsFiltres: Client[] = [];
  showClientDropdown = false;
  modePaiement: ModePaiement = ModePaiement.ESPECES;
  referencePaiement = '';
  remiseGlobale = 0;
  typeRemiseGlobale: RemiseType = RemiseType.POURCENTAGE;
  estCredit = false;
  clientId?: number;
  clientNom = '';
  clientPrenom = '';
  clientTelephone = '';
  creerClient = false;
  dateEcheance = '';
  montantVerse = 0;
  soldeAvanceClient = 0;
  utiliserAvance = false;
  montantAvanceAUtiliser = 0;
  isLoadingAvance = false;
  submitting = false;

  modes = Object.values(ModePaiement);
  remiseTypes = Object.values(RemiseType);

  // Conditionnement
  conditionnementActif = false;
  showNiveauxVenteModal = false;
  produitEnAttente: Produit | null = null;
  niveauxDisponibles: ProduitNiveau[] = [];
  loadingNiveauxVente = false;

  constructor(
    private productService: ProductService,
    public clientService: ClientService,
    public venteService: VenteService,
    private auth: AuthService,
    private toastCtrl: ToastController,
    private barcodeService: BarcodeService,
    private promotionService: PromotionService,
    private fonctionnalite: FonctionnaliteService,
    private niveauService: ProduitNiveauService
  ) {}

  async scanPourVente(): Promise<void> {
    const code = await this.barcodeService.scan();
    if (!code) return;

    const produit = this.products.find(p =>
      p.codeBarre === code || p.codeBarre?.trim() === code.trim()
    );

    if (produit) {
      this.add(produit);
      const toast = await this.toastCtrl.create({
        message: `✓ ${produit.nom} ajouté`,
        color: 'success', duration: 1500, position: 'top'
      });
      await toast.present();
    } else {
      const toast = await this.toastCtrl.create({
        message: `Produit introuvable pour le code : ${code}`,
        color: 'warning', duration: 2500, position: 'top'
      });
      await toast.present();
    }
  }

  ngOnInit() {
    this.conditionnementActif = this.fonctionnalite.isConditionnementActif();
    this.loadProducts();
    this.loadClients();
    const due = new Date();
    due.setDate(due.getDate() + 30);
    this.dateEcheance = due.toISOString().split('T')[0];
  }

  ionViewWillEnter(): void {
    this.conditionnementActif = this.fonctionnalite.isConditionnementActif();
  }

  loadClients(): void {
    this.clientService.getAll().subscribe({
      next: clients => { this.clients = clients; this.clientsFiltres = clients.slice(0, 8); },
      error: () => this.clients = []
    });
  }

  filterClients(): void {
    const term = this.clientSearch.trim().toLowerCase();
    if (!term) { this.clientsFiltres = this.clients.slice(0, 8); this.showClientDropdown = false; return; }
    this.clientsFiltres = this.clients.filter(c =>
      (c.nom || '').toLowerCase().includes(term) ||
      (c.prenom || '').toLowerCase().includes(term) ||
      (c.telephone || c.numeroTelephone || '').includes(term)
    ).slice(0, 10);
    this.showClientDropdown = this.clientsFiltres.length > 0;
  }

  pickClient(client: Client): void {
    this.clientId = client.id;
    this.clientSearch = `${client.nom || ''} ${client.prenom || ''}`.trim();
    if (client.telephone || client.numeroTelephone) {
      this.clientSearch += ` · ${client.telephone || client.numeroTelephone}`;
    }
    this.showClientDropdown = false;
    this.selectClient();
  }

  clearClient(): void {
    this.clientId = undefined;
    this.clientSearch = '';
    this.clientNom = '';
    this.clientPrenom = '';
    this.clientTelephone = '';
    this.showClientDropdown = false;
    this.soldeAvanceClient = 0;
    this.utiliserAvance = false;
  }

  loadProducts(): void {
    this.productService.getProducts().subscribe({
      next: products => {
        this.products = products.filter(product => product.quantite > 0);
        this.applySearch();
      },
      error: error => this.presentToast(error.message || 'Produits indisponibles', 'danger')
    });
  }

  applySearch(): void {
    const term = this.query.trim().toLowerCase();
    this.filteredProducts = this.products
      .filter(product => !term || product.nom.toLowerCase().includes(term) || product.codeBarre?.toLowerCase().includes(term))
      .slice(0, 20);
  }

  add(product: Produit): void {
    if (product.quantite <= 0) {
      this.presentToast('Produit en rupture de stock', 'danger');
      return;
    }
    const existing = this.items.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.quantite) {
        existing.quantity++;
      } else {
        this.presentToast(`Stock maximum atteint : ${product.quantite} unité(s)`, 'danger');
      }
      return;
    }

    // Si conditionnement actif → vérifier si le produit a des niveaux
    if (this.conditionnementActif) {
      this.produitEnAttente = product;
      this.loadingNiveauxVente = true;
      this.showNiveauxVenteModal = true;
      this.niveauxDisponibles = [];
      this.niveauService.getNiveaux(product.id!).subscribe({
        next: niveaux => {
          this.niveauxDisponibles = niveaux;
          this.loadingNiveauxVente = false;
          // Si aucun niveau défini, ajouter directement comme avant
          if (niveaux.length === 0) {
            this.showNiveauxVenteModal = false;
            this.addWithPromo(product);
          }
        },
        error: () => {
          this.loadingNiveauxVente = false;
          this.showNiveauxVenteModal = false;
          this.addWithPromo(product);
        }
      });
    } else {
      this.addWithPromo(product);
    }
  }

  choisirNiveau(niveau: ProduitNiveau): void {
    const product = this.produitEnAttente;
    if (!product) return;
    this.showNiveauxVenteModal = false;
    this.produitEnAttente = null;

    // Vérifier promos puis ajouter avec les infos du niveau
    this.promotionService.getPromosPourProduit(product.id!).subscribe({
      next: promos => {
        const promo = promos[0];
        const prixOriginal = niveau.prixVente;
        const customPrice = promo
          ? this.promotionService.calculerPrixPromo(prixOriginal, promo)
          : prixOriginal;
        this.items = [...this.items, {
          product, quantity: 1, remisePourcentage: 0,
          customPrice, editingPrice: false,
          promo: promo || undefined,
          prixOriginal,
          niveauPrixAchat: niveau.prixAchat,
          niveauNom: niveau.nom
        }];
        if (promo) {
          const label = promo.typeReduction === 'POURCENTAGE'
            ? `-${promo.valeurReduction}%`
            : `-${promo.valeurReduction} FCFA`;
          this.presentToast(`🏷️ ${promo.titre} ${label} appliqué`, 'success');
        } else {
          this.presentToast(`${niveau.nom} — ${this.money(niveau.prixVente)} ajouté`);
        }
      },
      error: () => {
        this.items = [...this.items, {
          product, quantity: 1, remisePourcentage: 0,
          customPrice: niveau.prixVente, editingPrice: false,
          niveauPrixAchat: niveau.prixAchat,
          niveauNom: niveau.nom
        }];
      }
    });
  }

  annulerChoixNiveau(): void {
    this.showNiveauxVenteModal = false;
    this.produitEnAttente = null;
    this.niveauxDisponibles = [];
  }

  private addWithPromo(product: Produit): void {
    this.promotionService.getPromosPourProduit(product.id!).subscribe({
      next: promos => {
        const promo = promos[0];
        const prixOriginal = product.prixVente;
        const customPrice = promo
          ? this.promotionService.calculerPrixPromo(prixOriginal, promo)
          : prixOriginal;
        this.items = [...this.items, {
          product, quantity: 1, remisePourcentage: 0,
          customPrice, editingPrice: false,
          promo: promo || undefined,
          prixOriginal
        }];
        if (promo) {
          const label = promo.typeReduction === 'POURCENTAGE'
            ? `-${promo.valeurReduction}%`
            : `-${promo.valeurReduction} FCFA`;
          this.presentToast(`🏷️ ${promo.titre} ${label} appliqué`, 'success');
        }
      },
      error: () => {
        this.items = [...this.items, {
          product, quantity: 1, remisePourcentage: 0,
          customPrice: product.prixVente, editingPrice: false
        }];
      }
    });
  }

  remove(productId: number): void {
    this.items = this.items.filter(item => item.product.id !== productId);
  }

  clampQty(item: CartItem): void {
    if (item.quantity < 1) item.quantity = 1;
    if (item.quantity > item.product.quantite) {
      item.quantity = item.product.quantite;
      this.presentToast(`Stock maximum : ${item.product.quantite} unité(s)`, 'danger');
    }
  }

  totalLine(item: CartItem): number {
    const price = this.venteService.calculerPrixApresRemise(item.customPrice, item.remisePourcentage || 0, null);
    return price * item.quantity;
  }

  toggleEditPrice(item: CartItem): void {
    item.editingPrice = !item.editingPrice;
    if (!item.editingPrice) {
      item.customPrice = item.product.prixVente;
    }
  }

  clampPrice(item: CartItem): void {
    if (!item.customPrice || item.customPrice < 0) item.customPrice = 0;
  }

  subTotal(): number {
    return this.items.reduce((sum, item) => sum + this.totalLine(item), 0);
  }

  total(): number {
    const subTotal = this.subTotal();
    if (!this.remiseGlobale) return subTotal;
    if (this.typeRemiseGlobale === RemiseType.POURCENTAGE) {
      return Math.max(0, subTotal - (subTotal * this.remiseGlobale / 100));
    }
    return Math.max(0, subTotal - this.remiseGlobale);
  }

  selectClient(): void {
    const client = this.clients.find(item => item.id === Number(this.clientId));
    if (!client) return;
    this.clientNom = client.nom || '';
    this.clientPrenom = client.prenom || '';
    this.clientTelephone = client.telephone || client.numeroTelephone || '';
    this.creerClient = false;
    this.soldeAvanceClient = 0;
    this.utiliserAvance = false;
    this.montantAvanceAUtiliser = 0;
    if (client.nom) {
      this.isLoadingAvance = true;
      this.clientService.getSoldeAvance(client.nom, client.telephone || client.numeroTelephone).subscribe({
        next: res => { this.soldeAvanceClient = res.soldeDisponible || 0; this.isLoadingAvance = false; },
        error: () => { this.soldeAvanceClient = 0; this.isLoadingAvance = false; }
      });
    }
  }

  get resteAPayerCredit(): number {
    return Math.max(0, this.total() - Number(this.montantVerse || 0) - (this.utiliserAvance ? Number(this.montantAvanceAUtiliser || 0) : 0));
  }

  utiliserTouteAvance(): void {
    this.montantAvanceAUtiliser = Math.min(this.soldeAvanceClient, this.total());
  }

  private validateStock(): boolean {
    for (const item of this.items) {
      if (item.quantity <= 0) {
        this.presentToast(`Quantité invalide pour ${item.product.nom}`, 'danger');
        return false;
      }
      if (item.quantity > item.product.quantite) {
        this.presentToast(`Stock insuffisant pour ${item.product.nom}. Disponible : ${item.product.quantite}`, 'danger');
        return false;
      }
      if (item.customPrice < 0) {
        this.presentToast(`Prix invalide pour ${item.product.nom}`, 'danger');
        return false;
      }
    }
    return true;
  }

  submit(): void {
    if (!this.items.length) {
      this.presentToast('Ajoutez au moins un produit', 'danger');
      return;
    }

    if (this.estCredit && !this.clientNom.trim()) {
      this.presentToast('Nom client obligatoire pour un crédit', 'danger');
      return;
    }

    if (!this.validateStock()) return;

    this.submitting = true;
    const base = {
      vendeurId: this.auth.getUserId(),
      lignes: this.items.map(item => ({
        produitId: item.product.id,
        quantite: item.quantity,
        prixUnitaire: item.customPrice,
        remisePourcentage: item.remisePourcentage || null,
        remiseMontant: null,
        prixAchat: item.niveauPrixAchat || null,   // prix achat du niveau
        niveauNom: item.niveauNom || null            // nom du niveau
      })),
      modePaiement: this.modePaiement,
      referencePaiement: this.referencePaiement,
      remiseGlobale: Number(this.remiseGlobale || 0),
      typeRemiseGlobale: this.typeRemiseGlobale,
      clientId: this.clientId,
      clientNom: this.clientNom.trim(),
      clientPrenom: this.clientPrenom.trim(),
      clientTelephone: this.clientTelephone.trim(),
      dateEcheance: this.dateEcheance,
      montantVerse: Number(this.montantVerse || 0),
      montantAvanceUtilise: this.utiliserAvance ? Math.min(this.montantAvanceAUtiliser, this.soldeAvanceClient) : 0,
      creerClient: this.creerClient,
      clientDivers: !this.clientId && !this.clientNom.trim()
    };

    const request = this.estCredit
      ? this.venteService.createVenteCredit({ ...base, estCredit: true, clientNom: this.clientNom.trim(), dateEcheance: this.dateEcheance })
      : this.venteService.createVente({ ...base, estCredit: false });

    request.subscribe({
      next: vente => {
        this.submitting = false;
        this.presentToast(`Vente ${vente.numeroVente || vente.id} enregistrée`);
        this.reset();
        this.loadProducts();
      },
      error: error => {
        this.submitting = false;
        this.presentToast(error.message || 'Vente impossible', 'danger');
      }
    });
  }

  reset(): void {
    this.items = [];
    this.referencePaiement = '';
    this.remiseGlobale = 0;
    this.typeRemiseGlobale = RemiseType.POURCENTAGE;
    this.clientId = undefined;
    this.clientNom = '';
    this.clientPrenom = '';
    this.clientTelephone = '';
    this.creerClient = false;
    this.montantVerse = 0;
    this.soldeAvanceClient = 0;
    this.utiliserAvance = false;
    this.montantAvanceAUtiliser = 0;
    this.estCredit = false;
  }

  money(value: number): string {
    return this.productService.formatPrice(value);
  }

  getPaymentIcon(mode: ModePaiement): string {
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
    const toast = await this.toastCtrl.create({ message, color, duration: 2400, position: 'top' });
    await toast.present();
  }
}
