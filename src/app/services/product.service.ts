import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ImportResult {
  success: number;
  failed: number;
  total: number;
  errors: string[];
  details?: string[];
}

export interface Categorie {
  id: number;
  nom: string;
  description?: string;
}

export interface Fournisseur {
  id: number;
  nom: string;
  code?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  description?: string;
  actif?: boolean;
  solde?: number;
}

export interface FournisseurRequest {
  nom: string;
  code?: string;
  adresse?: string;
  telephone?: string;
  email?: string;
  description?: string;
  actif?: boolean;
}

export interface Produit {
  id: number;
  nom: string;
  description?: string;
  categorie?: Categorie;
  categorieId?: number;
  categorieNom?: string;
  fournisseur?: Fournisseur;
  fournisseurId?: number;
  fournisseurNom?: string;
  prixAchat: number;
  prixVente: number;
  quantite: number;
  seuilAlerte: number;
  codeBarre?: string;
  datePeremption?: string;
  stockFaible?: boolean;
  perime?: boolean;
  prochePeremption?: boolean;
  bio?: boolean;
  typeVente?: string;
}

export interface ProduitRequest {
  nom: string;
  description?: string;
  categorieId: number;
  fournisseurId?: number;
  prixAchat: number;
  prixVente: number;
  quantite: number;
  seuilAlerte?: number;
  codeBarre?: string;
  datePeremption?: string;
  bio?: boolean;
  typeVente?: string;
}

export interface StatistiquesStock {
  valeurTotale: number;
  produitsStockFaible: number;
  produitsRupture: number;
  produitsPerimes?: number;
  totalProduits: number;
  totalFournisseurs?: number;
}

export interface LigneAchatRequest {
  produitId?: number;
  nouveauProduitNom?: string;
  nouvelleCategorieId?: number;
  quantite: number;
  prixAchatUnitaire: number;
  prixVente?: number;
  description?: string;
  codeBarre?: string;
  seuilAlerte?: number;
}

export interface AchatFournisseurRequest {
  fournisseurId?: number;
  nouveauFournisseur?: FournisseurRequest;
  lignes: LigneAchatRequest[];
  montantPaye?: number;
  commentaire?: string;
  utilisateurId?: number;
  modePaiementImmediat?: string;
  compteIdPaiement?: number;
}

export interface PaiementFournisseurRequest {
  fournisseurId: number;
  montant: number;
  modePaiement: 'ESPECES' | 'VIREMENT' | 'CHEQUE' | 'BANQUE' | string;
  reference?: string;
  observation?: string;
  utilisateurId?: number;
  compteId?: number;
  achatCibleId?: number;
}

export interface AvanceFournisseurRequest {
  fournisseurId: number;
  montant: number;
  modePaiement: string;
  reference?: string;
  observation?: string;
  utilisateurId?: number;
  compteId?: number;
}

export interface RetourAchatRequest {
  achatId: number;
  motif?: string;
  utilisateurId?: number;
  lignes: Array<{
    ligneAchatId?: number;
    produitId: number;
    quantiteRetournee: number;
    prixAchatUnitaire: number;
  }>;
}

export interface RetourVenteRequest {
  venteId: number;
  motif?: string;
  utilisateurId?: number;
  lignes: Array<{
    ligneVenteId?: number;
    produitId: number;
    quantiteRetournee: number;
    prixUnitaire: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly apiUrl = `${environment.apiUrl}/produits`;
  private readonly fournisseurAchatApiUrl = `${environment.apiUrl}/fournisseur-achats`;

  constructor(private http: HttpClient) {}

  getProducts(): Observable<Produit[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => this.extractList<Produit>(response)),
      map(products => products.map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'récupérer les produits'))
    );
  }

  getProductsDto(): Observable<Produit[]> {
    return this.http.get<any>(`${this.apiUrl}/dto`).pipe(
      map(response => this.extractList<Produit>(response)),
      map(products => products.map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'récupérer les produits'))
    );
  }

  getProductById(id: number): Observable<Produit> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => this.extractOne<Produit>(response)),
      map(product => this.enrichProduct(product)),
      catchError(error => this.handleError(error, 'récupérer le produit'))
    );
  }

  getProductByCodeBarre(codeBarre: string): Observable<Produit> {
    return this.http.get<any>(`${this.apiUrl}/code-barre/${encodeURIComponent(codeBarre)}`).pipe(
      map(response => this.enrichProduct(this.extractOne<Produit>(response))),
      catchError(error => this.handleError(error, 'rechercher le code-barres'))
    );
  }

  getProductsByCategory(categoryId: number): Observable<Produit[]> {
    return this.http.get<any>(`${this.apiUrl}/categorie/${categoryId}`).pipe(
      map(response => this.extractList<Produit>(response)),
      map(products => products.map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'récupérer les produits de la catégorie'))
    );
  }

  getProductsByFournisseur(fournisseurId: number): Observable<Produit[]> {
    return this.http.get<any>(`${this.apiUrl}/fournisseur/${fournisseurId}`).pipe(
      map(response => this.extractList<Produit>(response)),
      map(products => products.map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'récupérer les produits du fournisseur'))
    );
  }

  searchProducts(term: string): Observable<Produit[]> {
    if (!term.trim()) return this.getProducts();

    const params = new HttpParams().set('motCle', term.trim());
    return this.http.get<any>(`${this.apiUrl}/recherche`, { params }).pipe(
      map(response => this.extractList<Produit>(response)),
      map(products => products.map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'rechercher les produits'))
    );
  }

  createProduct(product: ProduitRequest): Observable<Produit> {
    return this.http.post<any>(this.apiUrl, this.cleanProductPayload(product)).pipe(
      map(response => this.enrichProduct(this.extractOne<Produit>(response))),
      catchError(error => this.handleError(error, 'créer le produit'))
    );
  }

  updateProduct(id: number, product: Partial<ProduitRequest>): Observable<Produit> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, this.cleanProductPayload(product)).pipe(
      map(response => this.enrichProduct(this.extractOne<Produit>(response))),
      catchError(error => this.handleError(error, 'modifier le produit'))
    );
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => undefined),
      catchError(error => this.handleError(error, 'supprimer le produit'))
    );
  }

  getLowStockProducts(): Observable<Produit[]> {
    return this.http.get<any>(`${this.apiUrl}/stock-faible`).pipe(
      map(response => this.extractList<Produit>(response).map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'récupérer le stock faible'))
    );
  }

  getExpiredProducts(): Observable<Produit[]> {
    return this.http.get<any>(`${this.apiUrl}/perimes`).pipe(
      map(response => this.extractList<Produit>(response).map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'récupérer les produits périmés'))
    );
  }

  getNearExpiryProducts(days = 7): Observable<Produit[]> {
    const params = new HttpParams().set('jours', String(days));
    return this.http.get<any>(`${this.apiUrl}/proches-peremption`, { params }).pipe(
      map(response => this.extractList<Produit>(response).map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'récupérer les produits proches péremption'))
    );
  }

  getBioProducts(): Observable<Produit[]> {
    return this.http.get<any>(`${this.apiUrl}/bio`).pipe(
      map(response => this.extractList<Produit>(response).map(product => this.enrichProduct(product))),
      catchError(error => this.handleError(error, 'récupérer les produits bio'))
    );
  }

  getStockStatistics(): Observable<StatistiquesStock> {
    return this.http.get<any>(`${this.apiUrl}/statistiques`).pipe(
      map(response => response?.data || response?.statistiques || response),
      catchError(error => this.handleError(error, 'récupérer les statistiques de stock'))
    );
  }

  getAllCategories(): Observable<Categorie[]> {
    return this.http.get<any>(`${this.apiUrl}/categories`).pipe(
      map(response => this.extractList<Categorie>(response)),
      catchError(error => this.handleError(error, 'récupérer les catégories'))
    );
  }

  createCategory(category: { nom: string; description?: string }): Observable<Categorie> {
    return this.http.post<any>(`${this.apiUrl}/categories`, category).pipe(
      map(response => this.extractOne<Categorie>(response)),
      catchError(error => this.handleError(error, 'créer la catégorie'))
    );
  }

  updateCategory(id: number, category: { nom: string; description?: string }): Observable<Categorie> {
    return this.http.put<any>(`${this.apiUrl}/categories/${id}`, category).pipe(
      map(response => this.extractOne<Categorie>(response)),
      catchError(error => this.handleError(error, 'modifier la catégorie'))
    );
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/categories/${id}`).pipe(
      map(() => undefined),
      catchError(error => this.handleError(error, 'supprimer la catégorie'))
    );
  }

  checkCategoryExists(name: string): Observable<boolean> {
    const params = new HttpParams().set('nom', name);
    return this.http.get<any>(`${this.apiUrl}/categories/existe`, { params }).pipe(
      map(response => !!(response?.exists ?? response?.data ?? response)),
      catchError(() => [false])
    );
  }

  getAllFournisseurs(): Observable<Fournisseur[]> {
    return this.http.get<any>(`${this.apiUrl}/fournisseurs`).pipe(
      map(response => this.extractList<Fournisseur>(response)),
      catchError(error => this.handleError(error, 'récupérer les fournisseurs'))
    );
  }

  getFournisseurById(id: number): Observable<Fournisseur> {
    return this.http.get<any>(`${this.apiUrl}/fournisseurs/${id}`).pipe(
      map(response => this.extractOne<Fournisseur>(response)),
      catchError(error => this.handleError(error, 'récupérer le fournisseur'))
    );
  }

  getFournisseurByCode(code: string): Observable<Fournisseur> {
    return this.http.get<any>(`${this.apiUrl}/fournisseurs/code/${encodeURIComponent(code)}`).pipe(
      map(response => this.extractOne<Fournisseur>(response)),
      catchError(error => this.handleError(error, 'récupérer le fournisseur par code'))
    );
  }

  getFournisseursActifs(): Observable<Fournisseur[]> {
    return this.http.get<any>(`${this.apiUrl}/fournisseurs/actifs`).pipe(
      map(response => this.extractList<Fournisseur>(response)),
      catchError(error => this.handleError(error, 'récupérer les fournisseurs actifs'))
    );
  }

  searchFournisseurs(term: string): Observable<Fournisseur[]> {
    const params = new HttpParams().set('motCle', term);
    return this.http.get<any>(`${this.apiUrl}/fournisseurs/recherche`, { params }).pipe(
      map(response => this.extractList<Fournisseur>(response)),
      catchError(error => this.handleError(error, 'rechercher les fournisseurs'))
    );
  }

  createFournisseur(fournisseur: FournisseurRequest): Observable<Fournisseur> {
    return this.http.post<any>(`${this.apiUrl}/fournisseurs`, fournisseur).pipe(
      map(response => this.extractOne<Fournisseur>(response)),
      catchError(error => this.handleError(error, 'créer le fournisseur'))
    );
  }

  updateFournisseur(id: number, fournisseur: FournisseurRequest): Observable<Fournisseur> {
    return this.http.put<any>(`${this.apiUrl}/fournisseurs/${id}`, fournisseur).pipe(
      map(response => this.extractOne<Fournisseur>(response)),
      catchError(error => this.handleError(error, 'modifier le fournisseur'))
    );
  }

  deleteFournisseur(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/fournisseurs/${id}`).pipe(
      map(() => undefined),
      catchError(error => this.handleError(error, 'supprimer le fournisseur'))
    );
  }

  getProduitsSimples(): Observable<Array<{ id: number; nom: string; prixAchat: number; prixVente: number; quantite: number }>> {
    return this.http.get<any>(`${this.fournisseurAchatApiUrl}/produits-simples`).pipe(
      map(response => this.extractList<{ id: number; nom: string; prixAchat: number; prixVente: number; quantite: number }>(response)),
      catchError(error => this.handleError(error, 'récupérer les produits simplifiés'))
    );
  }

  creerAchat(request: AchatFournisseurRequest): Observable<any> {
    return this.http.post<any>(`${this.fournisseurAchatApiUrl}/achat`, request).pipe(
      catchError(error => this.handleError(error, "créer l'achat fournisseur"))
    );
  }

  payerFournisseur(request: PaiementFournisseurRequest): Observable<any> {
    return this.http.post<any>(`${this.fournisseurAchatApiUrl}/paiement`, request).pipe(
      catchError(error => this.handleError(error, 'payer le fournisseur'))
    );
  }

  getSituationFournisseur(fournisseurId: number): Observable<any> {
    return this.http.get<any>(`${this.fournisseurAchatApiUrl}/situation/${fournisseurId}`).pipe(
      map(response => response?.data || response),
      catchError(error => this.handleError(error, 'récupérer la situation fournisseur'))
    );
  }

  getHistoriqueAchats(fournisseurId: number): Observable<any[]> {
    return this.http.get<any>(`${this.fournisseurAchatApiUrl}/achats/${fournisseurId}`).pipe(
      map(response => this.extractList(response, 'achats')),
      catchError(error => this.handleError(error, 'récupérer les achats fournisseur'))
    );
  }

  getHistoriquePaiements(fournisseurId: number): Observable<any[]> {
    return this.http.get<any>(`${this.fournisseurAchatApiUrl}/paiements/${fournisseurId}`).pipe(
      map(response => this.extractList(response, 'paiements')),
      catchError(error => this.handleError(error, 'récupérer les paiements fournisseur'))
    );
  }

  getResteAPayer(fournisseurId: number): Observable<number> {
    return this.getSituationFournisseur(fournisseurId).pipe(
      map(situation => Number(situation?.solde ?? situation?.resteAPayer ?? 0)),
      catchError(error => this.handleError(error, 'récupérer le reste à payer fournisseur'))
    );
  }

  enregistrerAvanceFournisseur(request: AvanceFournisseurRequest): Observable<any> {
    return this.http.post<any>(`${this.fournisseurAchatApiUrl}/avance`, request).pipe(
      catchError(error => this.handleError(error, "enregistrer l'avance fournisseur"))
    );
  }

  getSoldeAvanceFournisseur(fournisseurId: number): Observable<number> {
    return this.http.get<any>(`${this.fournisseurAchatApiUrl}/avance/solde/${fournisseurId}`).pipe(
      map(response => Number(response?.soldeDisponible ?? response?.data ?? response ?? 0)),
      catchError(() => [0])
    );
  }

  getHistoriqueAvancesFournisseur(fournisseurId: number): Observable<any[]> {
    return this.http.get<any>(`${this.fournisseurAchatApiUrl}/avance/historique/${fournisseurId}`).pipe(
      map(response => this.extractList(response, 'historique')),
      catchError(() => [[]])
    );
  }

  getAchatById(achatId: number): Observable<any> {
    return this.http.get<any>(`${this.fournisseurAchatApiUrl}/achat/${achatId}`).pipe(
      map(response => response?.data || response?.achat || response),
      catchError(error => this.handleError(error, 'récupérer les détails achat'))
    );
  }

  effectuerRetourAchat(request: RetourAchatRequest): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/retours-achats`, request).pipe(
      catchError(error => this.handleError(error, 'effectuer le retour achat'))
    );
  }

  getRetoursByAchat(achatId: number): Observable<any[]> {
    return this.http.get<any>(`${environment.apiUrl}/retours-achats/achat/${achatId}`).pipe(
      map(response => this.extractList(response, 'retours')),
      catchError(error => this.handleError(error, 'récupérer les retours achat'))
    );
  }

  getRetoursByFournisseur(fournisseurId: number): Observable<any[]> {
    return this.http.get<any>(`${environment.apiUrl}/retours-achats/fournisseur/${fournisseurId}`).pipe(
      map(response => this.extractList(response, 'retours')),
      catchError(error => this.handleError(error, 'récupérer les retours fournisseur'))
    );
  }

  annulerAchatFournisseur(achatId: number, utilisateurId?: number): Observable<any> {
    const params = utilisateurId ? new HttpParams().set('utilisateurId', String(utilisateurId)) : undefined;
    return this.http.delete<any>(`${this.fournisseurAchatApiUrl}/achat/${achatId}`, { params }).pipe(
      catchError(error => this.handleError(error, "annuler l'achat fournisseur"))
    );
  }

  effectuerRetourVente(request: RetourVenteRequest): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/retours-ventes`, request).pipe(
      catchError(error => this.handleError(error, 'effectuer le retour vente'))
    );
  }

  getRetoursByVente(venteId: number): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/retours-ventes/vente/${venteId}`).pipe(
      catchError(error => this.handleError(error, 'récupérer les retours vente'))
    );
  }

  getAllProduitsForDropdown(): Observable<Array<{ id: number; nom: string; prixAchat: number; prixVente?: number }>> {
    return this.getProducts().pipe(
      map(products => products.map(product => ({
        id: product.id,
        nom: product.nom,
        prixAchat: product.prixAchat,
        prixVente: product.prixVente
      })))
    );
  }

  filterLowStockProducts(products: Produit[]): Produit[] {
    return products.filter(product => product.stockFaible || Number(product.quantite || 0) <= Number(product.seuilAlerte || 0));
  }

  filterExpiredProducts(products: Produit[]): Produit[] {
    return products.filter(product => product.perime);
  }

  filterNearExpiryProducts(products: Produit[], days = 7): Produit[] {
    const now = new Date();
    return products.filter(product => {
      if (!product.datePeremption || product.perime) return false;
      const diffDays = Math.ceil((new Date(product.datePeremption).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays > 0 && diffDays <= days;
    });
  }

  filterBioProducts(products: Produit[]): Produit[] {
    return products.filter(product => product.bio);
  }

  calculateTotalStockValue(products: Produit[]): number {
    return products.reduce((total, product) => total + Number(product.prixAchat || 0) * Number(product.quantite || 0), 0);
  }

  calculateTotalSellingValue(products: Produit[]): number {
    return products.reduce((total, product) => total + Number(product.prixVente || 0) * Number(product.quantite || 0), 0);
  }

  calculateTotalPotentialProfit(products: Produit[]): number {
    return this.calculateTotalSellingValue(products) - this.calculateTotalStockValue(products);
  }

  peutEtreVenduACredit(product: Produit): boolean {
    return product.typeVente !== 'COMPTANT_UNIQUEMENT' && !this.estEnRupture(product);
  }

  estEnRupture(product: Produit): boolean {
    return Number(product.quantite || 0) <= 0;
  }

  getProduitAlerteMessage(product: Produit): string {
    if (this.estEnRupture(product)) return 'Rupture de stock';
    if (product.perime) return 'Produit périmé';
    if (product.prochePeremption) return 'Péremption proche';
    if (product.stockFaible) return 'Stock faible';
    return '';
  }

  importProducts(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.post<ImportResult>(`${this.apiUrl}/import`, formData).pipe(
      catchError(error => this.handleError(error, 'importer les produits'))
    );
  }

  downloadTemplate(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/template`, { responseType: 'blob' }).pipe(
      tap((blob: Blob) => this.downloadBlob(blob, 'template-produits.xlsx')),
      catchError(error => this.handleError(error, 'télécharger le template'))
    );
  }

  exportProducts(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export`, { responseType: 'blob' }).pipe(
      tap((blob: Blob) => this.downloadBlob(blob, `produits-${new Date().toISOString().split('T')[0]}.xlsx`)),
      catchError(error => this.handleError(error, 'exporter les produits'))
    );
  }

  exportFournisseurs(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/fournisseurs`, { responseType: 'blob' }).pipe(
      tap((blob: Blob) => this.downloadBlob(blob, `fournisseurs-${new Date().toISOString().split('T')[0]}.xlsx`)),
      catchError(error => this.handleError(error, 'exporter les fournisseurs'))
    );
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price || 0);
  }

  formatDate(date?: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('fr-FR');
  }

  private cleanProductPayload(product: Partial<ProduitRequest>): Partial<ProduitRequest> {
    return {
      ...product,
      seuilAlerte: product.seuilAlerte || 10,
      codeBarre: product.codeBarre || '',
      bio: !!product.bio
    };
  }

  private enrichProduct(product: Produit): Produit {
    const quantite = Number(product.quantite || 0);
    const seuilAlerte = Number(product.seuilAlerte || 0);
    const peremption = product.datePeremption ? new Date(product.datePeremption) : null;
    const now = new Date();
    const diffDays = peremption
      ? Math.ceil((peremption.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    return {
      ...product,
      quantite,
      seuilAlerte,
      stockFaible: quantite <= seuilAlerte,
      perime: peremption ? peremption < now : false,
      prochePeremption: diffDays !== undefined && diffDays > 0 && diffDays <= 7
    };
  }

  private extractList<T>(response: any, key?: string): T[] {
    if (Array.isArray(response)) return response;
    if (key && Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.produits)) return response.produits;
    if (Array.isArray(response?.categories)) return response.categories;
    if (Array.isArray(response?.fournisseurs)) return response.fournisseurs;
    if (Array.isArray(response?.content)) return response.content;
    return [];
  }

  private extractOne<T>(response: any): T {
    return response?.data || response?.produit || response?.categorie || response?.fournisseur || response;
  }

  private handleError(error: any, context: string): Observable<never> {
    let message = `Impossible de ${context}`;
    if (error.status === 0) message = 'Impossible de se connecter au serveur';
    if (error.error?.message) message = error.error.message;
    if (typeof error.error === 'string') message = error.error;
    return throwError(() => new Error(message));
  }
}
