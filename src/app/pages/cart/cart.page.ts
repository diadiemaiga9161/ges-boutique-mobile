import { Component, HostListener, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { Client, ClientService } from '../../services/client.service';
import { ProductService, Produit } from '../../services/product.service';
import { ModePaiement, RemiseType, VenteService } from '../../services/vente.service';
import { BarcodeService } from '../../services/barcode.service';
import { Promotion, PromotionService } from '../../services/promotion.service';
import { FonctionnaliteService } from '../../services/fonctionnalite.service';
import { ProduitNiveau, ProduitNiveauService } from '../../services/produit-niveau.service';
import { UniteVente, UniteVenteService } from '../../services/unite-vente.service';
import { OfflineDbService } from '../../services/offline-db.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { OfflineSyncService } from '../../services/offline-sync.service';
import { ConfirmationVocaleService } from '../../services/confirmation-vocale.service';
import { BoutiqueService } from '../../services/boutique.service';
import { FideliteService, SoldeFidelite } from '../../services/fidelite.service';
import { ImpressionRecuService } from '../../services/impression-recu.service';
import { VenteMap } from '../../services/vente.service';

import { infoMesure, prixAffiche, prixStocke, qteDoc, qteStockee, texteQte } from '../../utils/mesure.util';
import { ProduitImageService } from '../../services/produit-image.service';

import { ActionPermission, RoleService } from '../../services/role.service';
import { OffreQuantiteService } from '../../services/offre-quantite.service';
import { ModeEntrainementService } from '../../services/mode-entrainement.service';
import { remiseOffreLigne, ResultatOffre } from '../../utils/offres-quantite.util';
import { VenteVoixService } from '../../services/vente-voix.service';
import { CandidatVoix, meilleureVersion, normaliserVoix } from '../../utils/vente-voix.util';

/** Ligne comprise à la voix, en attente de confirmation par le vendeur. */
interface LigneVoixPanier {
  texte: string;
  candidats: CandidatVoix<Produit>[];
  produit: Produit | null;
  /** Quantité dans l'unité affichée (pièces, cartons, kg, L, m). */
  quantite: number;
  /** Conditionnement dit (« carton ») et unité de vente retrouvée pour ce produit. */
  conditionnement: string | null;
  unite: UniteVente | null;
}
interface CartItem {
  product: Produit;
  quantity: number;
  remisePourcentage: number;
  customPrice: number;
  editingPrice: boolean;
  promo?: Promotion;          // promo active appliquée sur ce produit
  prixOriginal?: number;      // prix avant promo
  niveauId?: number;          // ID du ProduitNiveau vendu (cascade stock) — ANCIEN système uniquement.
  niveauPrixAchat?: number;   // prix achat du niveau (conditionnement) OU de l'unité de vente (VENTE_GROS_DETAIL)
  niveauNom?: string;         // nom du niveau OU de l'unité de vente choisie (affichage identique)
  niveauFacteurTotal?: number; // facteur total vers unité de base (ex: 200 pour 1 Carton = 200 Pièces)
  niveauStockMax?: number;    // stock disponible du niveau sélectionné (ANCIEN système uniquement)
  // NB VENTE_GROS_DETAIL (nouvelle fonctionnalité, voir choisirUniteVente()) : réutilise
  // niveauPrixAchat/niveauNom/niveauFacteurTotal ci-dessus MAIS laisse toujours niveauId
  // undefined — c'est précisément ce qui distingue les deux systèmes côté backend (stock
  // unique déduit directement, pas de cascade). getStockMax()/getPrixAchatEffectif()
  // distinguent les deux cas via la présence de niveauId.
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
  quantitePrincipale = 0; // stock du produit principal pas encore décomposé (cartons fermés)

  // Vente en gros / détail (VENTE_GROS_DETAIL) — nouvelle fonctionnalité, alternative simple
  // à ProduitNiveau ci-dessus (stock unique du produit, pas de cascade). Activable/
  // désactivable par le super admin, voir BoutiqueService.fonctionnalitesAvancees$ (même
  // mécanisme que Dépôt garde/Fidélité). N'est consultée que si conditionnementActif est
  // false, pour ne jamais changer le comportement existant des boutiques utilisant déjà
  // l'ancien système de niveaux.
  venteGrosDetailActif = false;
  showUniteVenteModal = false;
  uniteVenteDisponibles: UniteVente[] = [];
  loadingUniteVente = false;

  // Programme de fidélité — désactivable côté super admin (voir BoutiqueService.
  // fonctionnalitesAvancees$, système déjà utilisé pour Dépôt garde/Comptes bancaires,
  // réutilisé tel quel ici). N'affiche rien si inactif ou si aucun client identifié
  // n'est sélectionné (pas "client divers").
  programmeFideliteActif = false;
  soldeFidelite: SoldeFidelite | null = null;
  loadingFidelite = false;
  pointsAUtiliser = 0;
  private pointValeurFidelite = 0; // taux courant (FCFA par point), chargé une fois

  // Impression du reçu sur imprimante thermique Bluetooth — désactivable côté super admin
  // (même mécanisme que Dépôt garde/Comptes bancaires/Fidélité, voir BoutiqueService.
  // fonctionnalitesAvancees$). Le bouton "Imprimer le reçu" n'apparaît qu'après une vente
  // réussie EN LIGNE (derniereVente non nul) ; c'est une action optionnelle et séparée qui
  // ne bloque jamais le flux de vente en cas d'erreur (voir ImpressionRecuService).
  impressionTicketActif = false;
  derniereVente: VenteMap | null = null;

  // Vente à la voix (VENTE_VOIX) : le micro remplit une liste à confirmer, jamais le panier
  // directement. Bouton absent si la fonction est coupée ou si le téléphone ne sait pas
  // reconnaître la voix (appli Android installée, vieux navigateur).
  venteVoixActif = false;
  voixOuverte = false;
  voixEcoute = false;
  voixTexte = '';
  voixErreur = '';
  voixLignes: LigneVoixPanier[] = [];

  constructor(
    private roleService: RoleService,
    private productService: ProductService,
    public clientService: ClientService,
    public venteService: VenteService,
    private auth: AuthService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private barcodeService: BarcodeService,
    private promotionService: PromotionService,
    private fonctionnalite: FonctionnaliteService,
    private niveauService: ProduitNiveauService,
    private uniteVenteService: UniteVenteService,
    private offlineDb: OfflineDbService,
    private networkStatus: NetworkStatusService,
    private offlineSync: OfflineSyncService,
    private confirmationVocale: ConfirmationVocaleService,
    private boutiqueService: BoutiqueService,
    private fideliteService: FideliteService,
    private impressionRecuService: ImpressionRecuService,
    public photos: ProduitImageService,
    private offreQuantiteService: OffreQuantiteService,
    public entrainement: ModeEntrainementService,
    private voix: VenteVoixService
  ) {}

  /** Bouton visible seulement si le rôle de la personne permet l'action (rôles personnalisés). */
  peut(module: string, action: ActionPermission): boolean {
    return this.roleService.peut(module, action);
  }


  async scanPourVente(): Promise<void> {
    const code = await this.barcodeService.scan();
    if (!code) return;

    const produit = this.produitParCode(code);

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

    // Programme fidélité — même mécanisme que Dépôt garde/Comptes bancaires (pas de
    // nouveau système créé, on lit juste fonctionnalitesAvancees$ de BoutiqueService).
    this.boutiqueService.fonctionnalitesAvancees$.subscribe(liste => {
      this.programmeFideliteActif = liste.find(f => f.cle === 'PROGRAMME_FIDELITE')?.actif === true;
      if (this.programmeFideliteActif && !this.pointValeurFidelite) {
        this.fideliteService.getParametres().subscribe({
          next: params => this.pointValeurFidelite = params.pointValeur || 0,
          error: () => {}
        });
      }
      this.venteGrosDetailActif = liste.find(f => f.cle === 'VENTE_GROS_DETAIL')?.actif === true;
      this.impressionTicketActif = liste.find(f => f.cle === 'IMPRESSION_TICKET')?.actif === true;
      this.venteVoixActif = liste.find(f => f.cle === 'VENTE_VOIX')?.actif === true && this.voix.disponible();
      // Offres par quantité du gérant : le serveur les applique ; on les garde ici pour
      // afficher le même total, y compris hors connexion.
      if (liste.find(f => f.cle === 'OFFRES_QUANTITE')?.actif === true) {
        this.offreQuantiteService.chargerEnCours().subscribe();
      } else if (liste.length) {
        this.offreQuantiteService.vider();
      }
    });
  }

  ionViewWillEnter(): void {
    this.conditionnementActif = this.fonctionnalite.isConditionnementActif();
    this.pageActive = true;
  }

  ionViewWillLeave(): void {
    this.pageActive = false;
    if (this.voixOuverte) this.fermerVoix();
  }

  // ---------------------------------------------------------------- douchette (caisse)
  // Une douchette USB se comporte comme un clavier : elle tape le code puis « Entrée ».

  private produitParCode(code: string): Produit | undefined {
    const c = code.trim();
    return this.products.find(p => p.codeBarre === code || p.codeBarre?.trim() === c);
  }

  /** « Entrée » dans la recherche : code-barres exact → ajouté directement ; sinon, s'il
   *  ne reste qu'un produit affiché, c'est lui qui est ajouté. La case est vidée pour le
   *  scan suivant (le curseur y reste). */
  ajouterParSaisie(): void {
    const saisie = this.query.trim();
    if (!saisie) return;
    const produit = this.produitParCode(saisie)
      ?? (this.filteredProducts.length === 1 ? this.filteredProducts[0] : undefined);
    if (produit) {
      this.ajouter(produit);
      this.query = '';
      this.applySearch();
    } else if (/^\d{6,}$/.test(saisie)) {
      // Code inconnu : on vide quand même, sinon le scan suivant s'écrirait à la suite.
      this.signalerCodeInconnu(saisie);
      this.query = '';
      this.applySearch();
    }
  }

  /** Ajoute puis, sur grand écran (panier dans la colonne de droite), fait apparaître
   *  la ligne du produit : un produit scanné en bas du panier resterait hors de vue. */
  ajouter(produit: Produit): void {
    this.add(produit);
    if (!window.matchMedia('(min-width: 1000px)').matches) return;
    setTimeout(() => {
      document.querySelector(`.cart-col--panier .cart-line[data-produit="${produit.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }

  private pageActive = false;
  private tamponDouchette = '';
  private dernierAppuiDouchette = 0;

  /** Scan alors qu'aucune case n'a le curseur (ex : juste après avoir touché un produit) :
   *  les touches tapées très vite puis « Entrée » sont lues comme un code-barres. */
  @HostListener('document:keydown', ['$event'])
  lireDouchette(e: KeyboardEvent): void {
    if (!this.pageActive || this.showNiveauxVenteModal || this.showUniteVenteModal || this.peseeProduit || this.voixOuverte) return;
    const cible = e.target as HTMLElement | null;
    if (cible?.closest('input, textarea, select, ion-input, ion-textarea, ion-searchbar, ion-alert, [contenteditable]')) return;

    const maintenant = Date.now();
    if (maintenant - this.dernierAppuiDouchette > 80) this.tamponDouchette = '';
    this.dernierAppuiDouchette = maintenant;

    if (e.key === 'Enter') {
      const code = this.tamponDouchette;
      this.tamponDouchette = '';
      if (code.length < 4) return;
      e.preventDefault();
      const produit = this.produitParCode(code);
      if (produit) this.ajouter(produit);
      else this.signalerCodeInconnu(code);
    } else if (e.key.length === 1) {
      this.tamponDouchette += e.key;
    }
  }

  private async signalerCodeInconnu(code: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: `Produit introuvable pour le code : ${code}`,
      color: 'warning', duration: 2500, position: 'top'
    });
    await toast.present();
  }

  loadClients(): void {
    if (this.networkStatus.isOnline()) {
      this.clientService.getAll().subscribe({
        next: async clients => {
          this.clients = clients;
          this.clientsFiltres = clients.slice(0, 8);
          await this.offlineDb.cacheClients(clients);
        },
        error: async () => {
          this.clients = await this.offlineDb.getClientsCache();
          this.clientsFiltres = this.clients.slice(0, 8);
        }
      });
    } else {
      this.offlineDb.getClientsCache().then(cached => {
        this.clients = cached;
        this.clientsFiltres = cached.slice(0, 8);
      });
    }
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
    this.soldeFidelite = null;
    this.pointsAUtiliser = 0;
  }

  loadProducts(): void {
    if (this.networkStatus.isOnline()) {
      this.productService.getProducts().subscribe({
        next: async products => {
          this.products = products.filter(p => p.quantite > 0);
          await this.offlineDb.cacheProduits(products);
          this.applySearch();
        },
        error: async () => {
          const cached = await this.offlineDb.getProduitsCache();
          this.products = cached.filter((p: any) => p.quantite > 0);
          this.applySearch();
          this.presentToast('Hors connexion — produits depuis le cache', 'warning');
        }
      });
    } else {
      this.offlineDb.getProduitsCache().then(cached => {
        this.products = cached.filter((p: any) => p.quantite > 0);
        this.applySearch();
        this.presentToast('Hors connexion — produits depuis le cache', 'warning');
      });
    }
  }

  applySearch(): void {
    const term = this.query.trim().toLowerCase();
    this.filteredProducts = this.products
      .filter(product => !term || product.nom.toLowerCase().includes(term) || product.codeBarre?.toLowerCase().includes(term))
      .slice(0, 20);
  }

  // ---------------------------------------------------------------- vente à la mesure
  // Produit vendu au kg/L/m : la pesée remplace le +1 (quantité en g, prix au g).
  peseeProduit: Produit | null = null;
  peseeItem: CartItem | null = null;
  /** Ouverture de la pesée, séparée du produit : le produit reste en place pendant
   *  l'animation de fermeture (sinon la fenêtre se redessine sans produit). */
  peseeOuverte = false;

  estMesure(p: any): boolean {
    return !!infoMesure(p);
  }

  uniteMesure(p: any): string {
    return infoMesure(p)?.unite || '';
  }

  prixCatalogue(p: Produit): string {
    const info = infoMesure(p as any);
    return info ? `${this.money(prixAffiche(p as any, p.prixVente))}/${info.unite}` : this.money(p.prixVente);
  }

  stockCatalogue(p: Produit): string {
    return infoMesure(p as any) ? texteQte(p as any, p.quantite) : qteDoc(p);
  }

  qteItem(item: CartItem): string {
    return texteQte(item.product as any, item.quantity);
  }

  /** Prix d'une ligne à la mesure, par kg/L/m (arrondi au centime pour la saisie). */
  prixItemAffiche(item: CartItem, prix?: number): number {
    return Math.round(prixAffiche(item.product as any, prix ?? item.customPrice) * 100) / 100;
  }

  majPrixMesure(item: CartItem, valeur: any): void {
    const v = parseFloat(String(valeur ?? '').replace(',', '.'));
    item.customPrice = prixStocke(item.product as any, isNaN(v) ? 0 : v);
  }

  ouvrirPesee(product: Produit, item: CartItem | null = null): void {
    this.peseeProduit = product;
    this.peseeItem = item;
    this.peseeOuverte = true;
  }

  /** Demande la fermeture (bouton Annuler, validation, glissement vers le bas). */
  fermerPesee(): void {
    this.peseeOuverte = false;
  }

  /** Fin de l'animation de fermeture : on peut oublier le produit. */
  peseeFermee(): void {
    this.peseeOuverte = false;
    this.peseeProduit = null;
    this.peseeItem = null;
  }

  validerPesee(res: { quantite: number; montant: number | null }): void {
    const product = this.peseeProduit;
    if (!product) return;
    // "Pour 500 F" : poids arrondi au gramme, prix ajusté pour tomber juste sur la somme.
    const prix = res.montant && res.quantite > 0 ? res.montant / res.quantite : null;
    if (this.peseeItem) {
      this.peseeItem.quantity = res.quantite;
      if (prix != null) this.peseeItem.customPrice = prix;
    } else {
      this.items = [...this.items, {
        product, quantity: res.quantite, remisePourcentage: 0,
        customPrice: prix ?? product.prixVente, editingPrice: false
      }];
    }
    this.fermerPesee();
  }

  add(product: Produit): void {
    if (product.quantite <= 0) {
      this.presentToast('Produit en rupture de stock', 'danger');
      return;
    }
    if (infoMesure(product as any)) {
      this.ouvrirPesee(product, this.items.find(item => item.product.id === product.id) || null);
      return;
    }
    const existing = this.items.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.quantity < product.quantite) {
        existing.quantity++;
      } else {
        this.presentToast(`Stock maximum atteint : ${qteDoc(product)} unité(s)`, 'danger');
      }
      return;
    }

    // Si conditionnement actif → vérifier si le produit a des niveaux (ANCIEN système,
    // comportement strictement inchangé). Sinon, si VENTE_GROS_DETAIL est actif → proposer
    // les unités de vente du produit (NOUVELLE fonctionnalité, stock unique). Les deux
    // systèmes ne sont volontairement jamais consultés simultanément.
    if (this.conditionnementActif) {
      this.produitEnAttente = product;
      this.loadingNiveauxVente = true;
      this.showNiveauxVenteModal = true;
      this.niveauxDisponibles = [];
      this.quantitePrincipale = 0;
      this.niveauService.getNiveauxEtPrincipal(product.id!).subscribe({
        next: ({ niveaux, quantitePrincipale }) => {
          this.niveauxDisponibles = niveaux;
          this.quantitePrincipale = quantitePrincipale;
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
    } else if (this.venteGrosDetailActif) {
      this.produitEnAttente = product;
      this.loadingUniteVente = true;
      this.showUniteVenteModal = true;
      this.uniteVenteDisponibles = [];
      this.uniteVenteService.getUnites(product.id!).subscribe({
        next: unites => {
          this.uniteVenteDisponibles = unites;
          this.loadingUniteVente = false;
          // Si aucune unité de vente définie pour ce produit, ajouter directement comme avant
          if (!unites.length) {
            this.showUniteVenteModal = false;
            this.addWithPromo(product);
          }
        },
        error: () => {
          this.loadingUniteVente = false;
          this.showUniteVenteModal = false;
          this.addWithPromo(product);
        }
      });
    } else {
      this.addWithPromo(product);
    }
  }

  /** Stock disponible pour une unité de vente (VENTE_GROS_DETAIL) : le produit n'a qu'un
   *  stock unique, donc le nombre max de cette unité vendable = stock ÷ facteur (arrondi
   *  à l'entier inférieur, ex: 25 pièces en stock avec 1 Cartouche = 10 pièces → 2 max). */
  disponibleUniteVente(unite: UniteVente): number {
    const facteur = unite.facteurBase > 0 ? unite.facteurBase : 1;
    return Math.floor((this.produitEnAttente?.quantite || 0) / facteur);
  }

  choisirUniteVente(unite: UniteVente): void {
    const product = this.produitEnAttente;
    if (!product) return;
    this.showUniteVenteModal = false;
    this.produitEnAttente = null;
    this.uniteVenteDisponibles = [];

    this.promotionService.getPromosPourProduit(product.id!).subscribe({
      next: (promos: Promotion[]) => {
        const promo = promos[0];
        const prixOriginal = unite.prixVente;
        const customPrice = promo
          ? this.promotionService.calculerPrixPromo(prixOriginal, promo)
          : prixOriginal;
        this.items = [...this.items, {
          product, quantity: 1, remisePourcentage: 0,
          customPrice, editingPrice: false,
          promo: promo || undefined,
          prixOriginal,
          // NE JAMAIS renseigner niveauId ici (voir commentaire sur CartItem) — c'est ce qui
          // distingue la déduction directe sur le stock unique (VENTE_GROS_DETAIL) de la
          // cascade de l'ancien système ProduitNiveau.
          niveauPrixAchat: unite.prixAchat,
          niveauNom: unite.nom,
          niveauFacteurTotal: unite.facteurBase,
        }];
        if (promo) {
          const label = promo.typeReduction === 'POURCENTAGE'
            ? `-${promo.valeurReduction}%`
            : `-${promo.valeurReduction} FCFA`;
          this.presentToast(`🏷️ ${promo.titre} ${label} appliqué`, 'success');
        } else {
          this.presentToast(`${unite.nom} — ${this.money(unite.prixVente)} ajouté`);
        }
      },
      error: () => {
        this.items = [...this.items, {
          product, quantity: 1, remisePourcentage: 0,
          customPrice: unite.prixVente, editingPrice: false,
          niveauPrixAchat: unite.prixAchat,
          niveauNom: unite.nom,
          niveauFacteurTotal: unite.facteurBase,
        }];
      }
    });
  }

  choisirUniteBase(): void {
    const product = this.produitEnAttente;
    if (!product) return;
    this.showUniteVenteModal = false;
    this.produitEnAttente = null;
    this.uniteVenteDisponibles = [];
    this.addWithPromo(product);
  }

  annulerChoixUniteVente(): void {
    this.showUniteVenteModal = false;
    this.produitEnAttente = null;
    this.uniteVenteDisponibles = [];
  }

  private calculerFacteurTotal(niveaux: ProduitNiveau[], niveau: ProduitNiveau): number {
    // Remonte la chaîne parentId pour calculer combien d'unités de base = 1 unité de ce niveau
    const facteurVersBase = (n: ProduitNiveau): number => {
      const child = niveaux.find(c => c.parentId === n.id);
      if (!child) return 1;
      return child.facteur * facteurVersBase(child);
    };
    return facteurVersBase(niveau);
  }

  choisirNiveau(niveau: ProduitNiveau): void {
    const product = this.produitEnAttente;
    if (!product) return;
    const facteurTotal = this.calculerFacteurTotal(this.niveauxDisponibles, niveau);
    const niveauStockMax = this.disponibleNiveau(niveau);
    this.showNiveauxVenteModal = false;
    this.produitEnAttente = null;

    // Vérifier promos puis ajouter avec les infos du niveau
    this.promotionService.getPromosPourProduit(product.id!).subscribe({
      next: (promos: Promotion[]) => {
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
          niveauId: niveau.id,
          niveauPrixAchat: niveau.prixAchat,
          niveauNom: niveau.nom,
          niveauFacteurTotal: facteurTotal,
          niveauStockMax
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
          niveauId: niveau.id,
          niveauPrixAchat: niveau.prixAchat,
          niveauNom: niveau.nom,
          niveauFacteurTotal: facteurTotal,
          niveauStockMax
        }];
      }
    });
  }

  choisirPrincipal(): void {
    const product = this.produitEnAttente;
    if (!product) return;
    this.showNiveauxVenteModal = false;
    this.produitEnAttente = null;
    this.niveauxDisponibles = [];
    this.quantitePrincipale = 0;
    this.addWithPromo(product);
  }

  /**
   * Stock réellement disponible pour un niveau, en cascadant récursivement
   * depuis ses parents jusqu'à la racine (produit principal) — miroir exact
   * de calculerDisponibleNiveau() côté backend. Le paramètre index n'est
   * plus utilisé (gardé pour compatibilité avec les appels du template).
   */
  disponibleNiveau(niveau: ProduitNiveau, index?: number): number {
    const map = new Map<number, ProduitNiveau>(
      this.niveauxDisponibles.filter(n => n.id !== undefined).map(n => [n.id!, n])
    );
    const calc = (n: ProduitNiveau): number => {
      const direct = n.stock ?? 0;
      const facteur = n.facteur > 0 ? n.facteur : 1;
      if (n.parentId === undefined || n.parentId === null) {
        // Niveau racine : son parent implicite est le produit principal
        // (quantitePrincipale = stock pas encore décomposé, ex: cartons fermés).
        return direct + this.quantitePrincipale * facteur;
      }
      const parent = map.get(n.parentId);
      if (!parent) return direct;
      return direct + calc(parent) * facteur;
    };
    return calc(niveau);
  }

  annulerChoixNiveau(): void {
    this.showNiveauxVenteModal = false;
    this.produitEnAttente = null;
    this.niveauxDisponibles = [];
    this.quantitePrincipale = 0;
  }

  private addWithPromo(product: Produit, quantity = 1): void {
    this.promotionService.getPromosPourProduit(product.id!).subscribe({
      next: (promos: Promotion[]) => {
        const promo = promos[0];
        const prixOriginal = product.prixVente;
        const customPrice = promo
          ? this.promotionService.calculerPrixPromo(prixOriginal, promo)
          : prixOriginal;
        this.items = [...this.items, {
          product, quantity, remisePourcentage: 0,
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
          product, quantity, remisePourcentage: 0,
          customPrice: product.prixVente, editingPrice: false
        }];
      }
    });
  }

  // ---------------------------------------------------------------- vente à la voix

  ouvrirVoix(): void {
    this.voixOuverte = true;
    this.voixLignes = [];
    this.ecouterVoix();
  }

  ecouterVoix(): void {
    if (this.voixEcoute) return;
    this.voixErreur = '';
    this.voixTexte = '';
    this.voixEcoute = true;
    this.voix.ecouter(t => this.voixTexte = t)
      .then(versions => {
        this.voixEcoute = false;
        const { texte, lignes } = meilleureVersion(versions, this.products);
        this.voixTexte = texte;
        const nouvelles = lignes.map(l => this.ligneVoix(l.morceau.texte, l.candidats, l.choisi,
          l.morceau.quantite, l.morceau.mesure, l.morceau.conditionnement));
        // Une nouvelle écoute complète la liste (le vendeur peut dicter en plusieurs fois).
        this.voixLignes = [...this.voixLignes, ...nouvelles];
        if (!nouvelles.length) this.voixErreur = 'Aucun produit compris. Réessayez en disant la quantité puis le nom.';
        nouvelles.forEach(l => this.chercherUniteVoix(l));
      })
      .catch((e: Error) => {
        this.voixEcoute = false;
        this.voixErreur = e.message;
      });
  }

  terminerEcouteVoix(): void {
    this.voix.terminer();
  }

  fermerVoix(): void {
    this.voix.arreter();
    this.voixEcoute = false;
    this.voixOuverte = false;
    this.voixLignes = [];
    this.voixTexte = '';
    this.voixErreur = '';
  }

  private ligneVoix(texte: string, candidats: CandidatVoix<Produit>[], choisi: Produit | null,
                    quantite: number | null, mesure: string | null, conditionnement: string | null): LigneVoixPanier {
    let q = quantite ?? 1;
    // « 500 grammes » d'un produit au kg : 0,5 kg ; « deux » d'un produit à la pièce : 2.
    if (choisi && infoMesure(choisi as any) && mesure === 'g') q = q / 1000;
    if (choisi && !infoMesure(choisi as any)) q = Math.max(1, Math.round(q));
    return { texte, candidats, produit: choisi, quantite: q, conditionnement, unite: null };
  }

  /** « deux cartons de lait » : retrouve l'unité « Carton » du produit (vente en gros/détail). */
  private chercherUniteVoix(l: LigneVoixPanier): void {
    l.unite = null;
    if (!l.produit || !l.conditionnement || !this.venteGrosDetailActif || this.conditionnementActif) return;
    const dit = normaliserVoix(l.conditionnement);
    this.uniteVenteService.getUnites(l.produit.id!).subscribe({
      next: unites => {
        l.unite = unites.find(u => {
          const nom = normaliserVoix(u.nom);
          return nom === dit || nom.startsWith(dit) || dit.startsWith(nom);
        }) || null;
      },
      error: () => l.unite = null
    });
  }

  choisirProduitVoix(l: LigneVoixPanier, produit: Produit): void {
    const ancien = l.produit;
    l.produit = produit;
    if (!ancien || !!infoMesure(ancien as any) !== !!infoMesure(produit as any)) {
      l.quantite = infoMesure(produit as any) ? l.quantite : Math.max(1, Math.round(l.quantite));
    }
    this.chercherUniteVoix(l);
  }

  retirerLigneVoix(index: number): void {
    this.voixLignes = this.voixLignes.filter((_, i) => i !== index);
  }

  uniteLigneVoix(l: LigneVoixPanier): string {
    if (!l.produit) return '';
    if (l.unite) return l.unite.nom;
    return infoMesure(l.produit as any)?.unite || l.produit.uniteBase || 'pièce(s)';
  }

  /** 0,5 et non 0.5 : écriture française. */
  qteVoix(l: LigneVoixPanier): string {
    return String(l.quantite).replace('.', ',');
  }

  pasVoix(l: LigneVoixPanier): number {
    return l.produit && infoMesure(l.produit as any) ? 0.25 : 1;
  }

  changerQuantiteVoix(l: LigneVoixPanier, sens: 1 | -1): void {
    const pas = this.pasVoix(l);
    l.quantite = Math.max(pas, Math.round((l.quantite + sens * pas) * 1000) / 1000);
  }

  voixPrete(): boolean {
    return this.voixLignes.some(l => l.produit && l.quantite > 0);
  }

  /** Met les lignes confirmées dans le panier, avec les mêmes règles qu'un ajout à la main. */
  ajouterLignesVoix(): void {
    const alertes: string[] = [];
    let ajoutes = 0;
    for (const l of this.voixLignes) {
      const p = l.produit;
      if (!p || !(l.quantite > 0)) continue;
      if (infoMesure(p as any)) {
        const g = Math.min(qteStockee(p as any, l.quantite), p.quantite);
        if (g < qteStockee(p as any, l.quantite)) alertes.push(`${p.nom} : stock limité à ${texteQte(p as any, p.quantite)}`);
        const existant = this.items.find(i => i.product.id === p.id);
        if (existant) existant.quantity = Math.min(p.quantite, existant.quantity + g);
        else this.items = [...this.items, { product: p, quantity: g, remisePourcentage: 0, customPrice: p.prixVente, editingPrice: false }];
        ajoutes++;
        continue;
      }
      if (l.unite) {
        const facteur = l.unite.facteurBase > 0 ? l.unite.facteurBase : 1;
        const max = Math.floor((p.quantite || 0) / facteur);
        const q = Math.min(l.quantite, max);
        if (q < l.quantite) alertes.push(`${p.nom} : ${max} ${l.unite.nom} au maximum`);
        if (q <= 0) continue;
        const existant = this.items.find(i => i.product.id === p.id && i.niveauId == null && i.niveauNom === l.unite!.nom);
        if (existant) existant.quantity = Math.min(max, existant.quantity + q);
        else this.items = [...this.items, {
          product: p, quantity: q, remisePourcentage: 0, customPrice: l.unite.prixVente, editingPrice: false,
          prixOriginal: l.unite.prixVente, niveauPrixAchat: l.unite.prixAchat, niveauNom: l.unite.nom,
          niveauFacteurTotal: l.unite.facteurBase,
        }];
        ajoutes++;
        continue;
      }
      const existant = this.items.find(i => i.product.id === p.id && i.niveauId == null && !i.niveauFacteurTotal);
      const deja = existant?.quantity || 0;
      const q = Math.min(l.quantite, Math.max(0, p.quantite - deja));
      if (q < l.quantite) alertes.push(`${p.nom} : stock limité à ${qteDoc(p)}`);
      if (q <= 0) continue;
      if (existant) existant.quantity = deja + q;
      else this.addWithPromo(p, q);
      ajoutes++;
    }
    const restants = this.voixLignes.filter(l => !l.produit).length;
    this.fermerVoix();
    if (ajoutes) this.presentToast(`${ajoutes} produit(s) ajouté(s) au panier`, 'success');
    if (alertes.length) this.presentToast(alertes.join(' · '), 'warning');
    else if (restants) this.presentToast(`${restants} ligne(s) sans produit choisi n'ont pas été ajoutées`, 'warning');
  }

  remove(productId: number): void {
    this.items = this.items.filter(item => item.product.id !== productId);
  }

  /** Retourne le stock disponible réel :
   *  - ANCIEN système (ProduitNiveau, niveauId défini) : stock propre du niveau (cascade).
   *  - NOUVEAU système (VENTE_GROS_DETAIL, niveauFacteurTotal défini mais PAS niveauId) :
   *    stock unique du produit ÷ facteur, arrondi à l'entier inférieur.
   *  - Sinon : stock du produit tel quel. */
  getStockMax(item: CartItem): number {
    if (item.niveauId !== undefined && item.niveauStockMax !== undefined) {
      return item.niveauStockMax;
    }
    if (item.niveauId === undefined && item.niveauFacteurTotal) {
      return Math.floor((item.product.quantite || 0) / item.niveauFacteurTotal);
    }
    return item.product.quantite;
  }

  clampQty(item: CartItem): void {
    const max = this.getStockMax(item);
    if (item.quantity < 1) item.quantity = 1;
    if (item.quantity > max) {
      item.quantity = max;
      this.presentToast(`Stock maximum : ${max} unité(s)`, 'danger');
    }
  }

  totalLine(item: CartItem): number {
    return Math.max(0, this.getPrixVenteEffectif(item) * item.quantity - this.offreLigne(item).remise);
  }

  /** Offre par quantité applicable à la ligne (mêmes conditions que le serveur). */
  offreLigne(item: CartItem): ResultatOffre {
    return remiseOffreLigne({
      produitId: item.product.id,
      quantite: Number(item.quantity) || 0,
      prixUnitaire: Number(item.customPrice) || 0,
      prixNormal: Number(item.product.prixVente) || 0,
      aRemise: (item.remisePourcentage || 0) > 0,
      parCarton: item.niveauId != null || (item.niveauFacteurTotal || 1) > 1,
      auPoids: this.estMesure(item.product)
    }, this.offreQuantiteService.enCours);
  }

  getPrixVenteEffectif(item: CartItem): number {
    return this.venteService.calculerPrixApresRemise(item.customPrice, item.remisePourcentage || 0, null);
  }

  getPrixAchatEffectif(item: CartItem): number {
    // niveauPrixAchat est renseigné à la fois par l'ancien système (ProduitNiveau, avec
    // niveauId) et par VENTE_GROS_DETAIL (sans niveauId) — voir choisirNiveau()/choisirUniteVente().
    return item.niveauPrixAchat != null ? item.niveauPrixAchat : (item.product.prixAchat || 0);
  }

  getBeneficeLigne(item: CartItem): number {
    return (this.getPrixVenteEffectif(item) - this.getPrixAchatEffectif(item)) * item.quantity - this.offreLigne(item).remise;
  }

  getBeneficeLigneAbs(item: CartItem): number {
    return Math.abs(this.getBeneficeLigne(item));
  }

  getBeneficeLigneColor(item: CartItem): string {
    const b = this.getBeneficeLigne(item);
    return b > 0 ? 'ci-benefice--gain' : b < 0 ? 'ci-benefice--perte' : 'ci-benefice--neutre';
  }

  getBeneficeLigneLabel(item: CartItem): string {
    const b = this.getBeneficeLigne(item);
    return b > 0 ? 'Bénéfice' : b < 0 ? 'Perte' : 'Équilibre';
  }

  isVenteSousPrixAchat(item: CartItem): boolean {
    return this.getPrixVenteEffectif(item) < this.getPrixAchatEffectif(item);
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

  getRemiseGlobaleMontant(): number {
    return Math.max(0, this.subTotal() - this.total());
  }

  getBeneficeTotal(): number {
    const beneficeLignes = this.items.reduce((sum, item) => sum + this.getBeneficeLigne(item), 0);
    return beneficeLignes - this.getRemiseGlobaleMontant();
  }

  getBeneficeTotalAbs(): number {
    return Math.abs(this.getBeneficeTotal());
  }

  getBeneficeTotalLabel(): string {
    const b = this.getBeneficeTotal();
    return b > 0 ? 'Bénéfice' : b < 0 ? 'Perte' : 'Équilibre';
  }

  getBeneficeTotalColor(): string {
    const b = this.getBeneficeTotal();
    return b > 0 ? 'totaux-benefice--gain' : b < 0 ? 'totaux-benefice--perte' : 'totaux-benefice--neutre';
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
    this.chargerSoldeFidelite();
  }

  /** Solde de points du client identifié sélectionné — n'affiche rien si la fonctionnalité
   * est désactivée ou hors ligne (échec silencieux, comme les autres appels de cette page). */
  private chargerSoldeFidelite(): void {
    this.soldeFidelite = null;
    this.pointsAUtiliser = 0;
    if (!this.programmeFideliteActif || !this.clientId) return;
    this.loadingFidelite = true;
    this.fideliteService.getSoldeClient(this.clientId).subscribe({
      next: solde => { this.soldeFidelite = solde; this.loadingFidelite = false; },
      error: () => { this.soldeFidelite = null; this.loadingFidelite = false; }
    });
  }

  clampPointsFidelite(): void {
    const max = this.soldeFidelite?.points || 0;
    if (!this.pointsAUtiliser || this.pointsAUtiliser < 0) this.pointsAUtiliser = 0;
    if (this.pointsAUtiliser > max) this.pointsAUtiliser = max;
  }

  /** Réduction FCFA correspondant aux points que le vendeur souhaite utiliser sur cette
   * vente — clampée au solde du client. Passe entièrement par le mécanisme remiseGlobale/
   * MONTANT_FIXE existant au moment de submit() ; ne modifie jamais total()/getRemiseGlobaleMontant(). */
  get reductionFidelite(): number {
    if (!this.programmeFideliteActif || !this.soldeFidelite) return 0;
    const max = this.soldeFidelite.points || 0;
    const points = Math.min(Math.max(0, Number(this.pointsAUtiliser) || 0), max);
    return points * (this.pointValeurFidelite || 0);
  }

  /** Montant réellement à payer, remise fidélité incluse — identique à total() si aucun
   * point n'est utilisé. Utilisé uniquement pour l'affichage et l'annonce vocale. */
  totalAvecFidelite(): number {
    return Math.max(0, this.total() - this.reductionFidelite);
  }

  get resteAPayerCredit(): number {
    return Math.max(0, this.totalAvecFidelite() - Number(this.montantVerse || 0) - (this.utiliserAvance ? Number(this.montantAvanceAUtiliser || 0) : 0));
  }

  utiliserTouteAvance(): void {
    this.montantAvanceAUtiliser = Math.min(this.soldeAvanceClient, this.totalAvecFidelite());
  }

  private validateStock(): boolean {
    for (const item of this.items) {
      if (item.quantity <= 0) {
        this.presentToast(`Quantité invalide pour ${item.product.nom}`, 'danger');
        return false;
      }
      // Si vente par niveau (cascade), vérifier le stock du niveau ; sinon stock principal
      const max = this.getStockMax(item);
      if (item.quantity > max) {
        this.presentToast(`Stock insuffisant pour ${item.product.nom}. Disponible : ${max}`, 'danger');
        return false;
      }
      if (item.customPrice < 0) {
        this.presentToast(`Prix invalide pour ${item.product.nom}`, 'danger');
        return false;
      }
    }
    return true;
  }

  async submit(): Promise<void> {
    if (this.submitting) return;
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
    // Réinitialisé à chaque tentative : le bouton "Imprimer le reçu" ne doit jamais rester
    // affiché pour une vente précédente si celle-ci est en cours de remplacement.
    this.derniereVente = null;

    // Programme fidélité : la réduction passe entièrement par le mécanisme remiseGlobale/
    // MONTANT_FIXE déjà existant (remise manuelle), exactement comme si le vendeur avait
    // tapé cette remise lui-même. Si aucun point n'est utilisé, remiseGlobale/
    // typeRemiseGlobale restent strictement identiques à avant cette fonctionnalité.
    const pointsFideliteUtilises = this.programmeFideliteActif && this.clientId
      ? Math.min(Math.max(0, Number(this.pointsAUtiliser) || 0), this.soldeFidelite?.points || 0)
      : 0;
    const remiseGlobaleAEnvoyer = pointsFideliteUtilises > 0
      ? this.getRemiseGlobaleMontant() + this.reductionFidelite
      : Number(this.remiseGlobale || 0);
    const typeRemiseGlobaleAEnvoyer = pointsFideliteUtilises > 0
      ? RemiseType.MONTANT_FIXE
      : this.typeRemiseGlobale;

    const base = {
      vendeurId: this.auth.getUserId(),
      lignes: this.items.map(item => ({
        produitId: item.product.id,
        quantite: item.quantity,
        prixUnitaire: item.customPrice,
        remisePourcentage: item.remisePourcentage || null,
        remiseMontant: null,
        prixAchat: item.niveauPrixAchat || null,
        niveauId: item.niveauId || null,
        niveauNom: item.niveauNom || null,
        niveauFacteur: item.niveauFacteurTotal || 1,
      })),
      modePaiement: this.modePaiement,
      referencePaiement: this.referencePaiement,
      remiseGlobale: Number(remiseGlobaleAEnvoyer || 0),
      typeRemiseGlobale: typeRemiseGlobaleAEnvoyer,
      clientId: this.clientId,
      clientNom: this.clientNom.trim(),
      clientPrenom: this.clientPrenom.trim(),
      clientTelephone: this.clientTelephone.trim(),
      dateEcheance: this.dateEcheance,
      montantVerse: Number(this.montantVerse || 0),
      montantAvanceUtilise: this.utiliserAvance ? Math.min(this.montantAvanceAUtiliser, this.soldeAvanceClient) : 0,
      creerClient: this.creerClient,
      clientDivers: !this.clientId && !this.clientNom.trim(),
      estCredit: this.estCredit,
    };

    // Mode entraînement : la vente n'est ni envoyée ni mise de côté hors ligne.
    if (this.entrainement.actif) {
      this.submitting = false;
      await this.afficherVenteEntrainement();
      this.reset();
      return;
    }

    const endpoint = this.estCredit ? '/api/ventes/credit' : '/api/ventes';

    // Mode hors ligne — pas d'id de vente disponible immédiatement, donc pas de débit
    // fidélité possible ici (la réduction reste appliquée via remiseGlobale ci-dessus,
    // mais le solde de points du client ne sera pas débité tant que la vente n'a pas
    // été synchronisée manuellement).
    if (!this.networkStatus.isOnline()) {
      await this.offlineSync.addOfflineAction(this.estCredit ? 'VENTE_CREDIT' : 'VENTE', endpoint, 'POST', base);
      this.mettreAJourStockLocal();
      this.submitting = false;
      this.presentSaleSuccess('📡 Vente enregistrée hors ligne — sera synchronisée au retour');
      this.confirmationVocale.annoncerMontant(this.totalAvecFidelite());
      this.reset();
      return;
    }

    const request = this.estCredit
      ? this.venteService.createVenteCredit({ ...base, estCredit: true, clientNom: this.clientNom.trim(), dateEcheance: this.dateEcheance })
      : this.venteService.createVente({ ...base, estCredit: false });

    request.subscribe({
      next: vente => {
        this.mettreAJourStockLocal();
        this.submitting = false;
        this.derniereVente = vente;
        this.presentSaleSuccess(`Vente ${vente.numeroVente || vente.id} enregistrée`);
        // Ticket automatique sur petite imprimante — ajouté le 20/09/2026, purement
        // optionnel et additif : ne se déclenche QUE si l'appareil a coché les deux
        // réglages dans Paramètres boutique (désactivés par défaut). N'affecte jamais
        // le flux de vente existant sinon (voir imprimerDernierRecu ci-dessous, inchangé).
        if (this.fonctionnalite.isImprimanteTicketActif() && this.fonctionnalite.isImpressionAutoActif()) {
          try { this.venteService.imprimerTicket(vente); } catch { /* jamais bloquant */ }
        }
        this.confirmationVocale.annoncerMontant(this.totalAvecFidelite());
        // Débit réel du solde de points — seulement une fois la vente créée avec succès.
        // Si ce débit échoue, la vente reste valide : on avertit juste le vendeur qu'il
        // faudra le refaire manuellement (on ne casse jamais une vente déjà encaissée).
        if (pointsFideliteUtilises > 0 && this.clientId && vente.id) {
          this.fideliteService.utiliserPoints(this.clientId, pointsFideliteUtilises, vente.id).subscribe({
            next: () => {},
            error: () => this.presentToast(
              `Vente enregistrée, mais le débit de ${pointsFideliteUtilises} point(s) fidélité a échoué — à refaire manuellement`,
              'danger'
            )
          });
        }
        this.reset();
      },
      error: async error => {
        // Pas de statut HTTP exploitable (0, undefined, null) = le serveur n'a jamais
        // répondu (coupure, timeout, mauvais signal...) : à ne jamais confondre avec
        // une vraie erreur métier, sous peine de perdre la vente au lieu de la mettre
        // en file. Un vrai statut (400, 401, 409, 500...) veut dire que le serveur a
        // bien reçu et traité la requête, donc que ce n'est pas un souci réseau.
        if (!error.status) {
          await this.offlineSync.addOfflineAction(this.estCredit ? 'VENTE_CREDIT' : 'VENTE', endpoint, 'POST', base);
          this.mettreAJourStockLocal();
          this.submitting = false;
          this.presentSaleSuccess('📡 Vente enregistrée hors ligne — sera synchronisée');
          this.confirmationVocale.annoncerMontant(this.totalAvecFidelite());
          this.reset();
          return;
        }
        // Vraie erreur serveur (stock, session, validation...) — ne pas la faire passer pour du hors ligne
        this.submitting = false;
        const message = error?.error?.message || 'Erreur lors de l\'enregistrement de la vente';
        this.presentToast(message, 'danger');
      }
    });
  }

  /** Faux ticket du mode entraînement : rien n'est enregistré (ni stock, ni caisse, ni crédit). */
  private async afficherVenteEntrainement(): Promise<void> {
    const lignes = this.items.map(i => `${i.quantity} × ${i.product.nom} — ${this.money(this.totalLine(i))}`).join('\n');
    const alerte = await this.alertCtrl.create({
      header: "Vente d'entraînement réussie",
      subHeader: `Total : ${this.money(this.totalAvecFidelite())}`,
      cssClass: 'alert-pre-line',
      message: `${lignes}\n\nC'est un entraînement : rien n'a été enregistré (ni stock, ni caisse${this.estCredit ? ', ni crédit' : ''}).`,
      buttons: [{ text: 'Vente suivante', cssClass: 'alert-btn-primary' }]
    });
    await alerte.present();
    await alerte.onDidDismiss();
  }

  private mettreAJourStockLocal(): void {
    for (const item of this.items) {
      const produit = this.products.find(p => p.id === item.product.id);
      if (produit) {
        produit.quantite = Math.max(0, produit.quantite - item.quantity);
      }
    }
    this.offlineDb.cacheProduits(this.products);
    this.applySearch();
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
    this.soldeFidelite = null;
    this.pointsAUtiliser = 0;
  }

  money(value: number): string {
    return this.productService.formatPrice(value);
  }

  /** Fait défiler la page jusqu'à la section 3 (Paiement) — utilisé par le bouton "Payer"
   *  du résumé sticky en bas d'écran (voir cart.page.html). Même pattern déjà utilisé pour
   *  un scroll-to-element dans le projet (voir CreditsPage.allerPage()). */
  scrollToPayment(): void {
    const el = document.querySelector('.cart-section--paiement');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  private async presentToast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2400, position: 'top' });
    await toast.present();
  }

  /** Bouton "Imprimer le reçu" affiché juste après une vente réussie — action entièrement
   *  optionnelle et séparée du flux de vente (voir ImpressionRecuService, qui n'affiche
   *  jamais rien de plus qu'un toast en cas d'erreur, sans jamais relancer d'exception ici). */
  imprimerDernierRecu(): void {
    if (!this.derniereVente) return;
    this.impressionRecuService.imprimerRecuVente(this.derniereVente, this.boutiqueService.getInfo());
  }

  /**
   * Confirmation de vente validée : popup centré (pas un toast en haut) qui se ferme tout seul.
   * Important : `message` doit rester du texte brut, jamais du HTML — Ionic n'interprète pas le
   * HTML dans `AlertController.message` par défaut (innerHTMLTemplatesEnabled=false), donc des
   * balises passées ici s'affichaient littéralement à l'écran au lieu d'être rendues. Le badge
   * "coche verte" est fait en CSS pur (::before sur .alert-message dans global.scss), pas en HTML.
   */
  private async presentSaleSuccess(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      cssClass: 'sale-success-alert',
      message,
      backdropDismiss: true,
    });
    await alert.present();
    setTimeout(() => alert.dismiss().catch(() => {}), 1700);
  }
}
