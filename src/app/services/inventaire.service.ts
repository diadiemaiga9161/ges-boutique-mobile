import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export enum TypeMouvement {
  ENTREE = 'ENTREE',
  SORTIE = 'SORTIE',
  AJUSTEMENT = 'AJUSTEMENT',
  RETOUR = 'RETOUR',
  BONUS_FOURNISSEUR = 'BONUS_FOURNISSEUR'
}

export interface ProduitStock {
  id: number;
  nom: string;
  prixAchat: number;
  prixVente: number;
  quantite: number;
  seuilAlerte: number;
  stockFaible?: boolean;
  categorie?: {
    id: number;
    nom: string;
  };
}

export interface MouvementStock {
  id: number;
  produit: ProduitStock;
  quantite: number;
  typeMouvement: TypeMouvement | string;
  quantiteAvant: number;
  quantiteApres: number;
  motif: string;
  dateMouvement: string;
  utilisateur?: {
    id: number;
    nomComplet: string;
  };
}

export interface MouvementRequest {
  produitId: number;
  quantite: number;
  motif: string;
  utilisateurId?: number;
  dateMouvement?: string;
}

export interface AjustementRequest {
  produitId: number;
  nouvelleQuantite: number;
  motif: string;
  utilisateurId?: number;
  dateAjustement?: string;
}

export interface StatistiquesInventaire {
  produitsStockFaible: number;
  produitsRupture: number;
  valeurTotaleStock: number;
  totalEntrees: number;
  totalSorties: number;
  variationNet: number;
}

@Injectable({
  providedIn: 'root'
})
export class InventaireService {
  private readonly apiUrl = `${environment.apiUrl}/inventaire`;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  entreeStock(mouvement: MouvementRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/entree`, this.withUser(mouvement)).pipe(
      catchError(error => this.handleError(error, "enregistrer l'entrée de stock"))
    );
  }

  sortieStock(mouvement: MouvementRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/sortie`, this.withUser(mouvement)).pipe(
      catchError(error => this.handleError(error, 'enregistrer la sortie de stock'))
    );
  }

  ajusterStock(ajustement: AjustementRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/ajustement`, this.withUser(ajustement)).pipe(
      catchError(error => this.handleError(error, 'ajuster le stock'))
    );
  }

  obtenirTousMouvements(): Observable<MouvementStock[]> {
    return this.http.get<any>(`${this.apiUrl}/mouvements`).pipe(
      map(response => this.extractList<MouvementStock>(response)),
      catchError(error => this.handleError(error, 'récupérer les mouvements'))
    );
  }

  obtenirMouvementsParDate(debut: string, fin: string): Observable<MouvementStock[]> {
    const params = new HttpParams().set('debut', debut).set('fin', fin);
    return this.http.get<any>(`${this.apiUrl}/historique`, { params }).pipe(
      map(response => this.extractList<MouvementStock>(response)),
      catchError(error => this.handleError(error, 'récupérer les mouvements'))
    );
  }

  obtenirProduitsStockFaible(): Observable<ProduitStock[]> {
    return this.http.get<any>(`${this.apiUrl}/stock-faible`).pipe(
      map(response => this.extractList<ProduitStock>(response).map(product => ({
        ...product,
        stockFaible: product.quantite <= product.seuilAlerte
      }))),
      catchError(error => this.handleError(error, 'récupérer les produits en stock faible'))
    );
  }

  obtenirStatistiquesInventaire(): Observable<StatistiquesInventaire> {
    return this.http.get<any>(`${this.apiUrl}/statistiques`).pipe(
      map(response => response?.data || response?.statistiques || response),
      catchError(error => this.handleError(error, 'récupérer les statistiques inventaire'))
    );
  }

  getCurrentDateTime(): string {
    return new Date().toISOString();
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  formatDateTimeForDisplay(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTypeMouvementLabel(type: string): string {
    const labels: Record<string, string> = {
      ENTREE: 'Entrée',
      SORTIE: 'Sortie',
      AJUSTEMENT: 'Ajustement',
      RETOUR: 'Retour',
      BONUS_FOURNISSEUR: 'Bonus Fournisseur',
      VENTE: 'Vente',
      ANNULATION_VENTE: 'Annulation vente',
      CREDIT: 'Crédit',
      ANNULATION_CREDIT: 'Annulation crédit',
      DECOMPOSITION: 'Décomposition',
      RECOMPOSITION: 'Recomposition'
    };
    return labels[type] || type;
  }

  getTypeMouvementClass(type: string): string {
    const classes: Record<string, string> = {
      ENTREE: 'text-success',
      SORTIE: 'text-danger',
      AJUSTEMENT: 'text-warning',
      RETOUR: 'text-info',
      BONUS_FOURNISSEUR: 'text-success',
      VENTE: 'text-danger',
      ANNULATION_VENTE: 'text-success',
      CREDIT: 'text-warning',
      ANNULATION_CREDIT: 'text-success',
      DECOMPOSITION: 'text-primary',
      RECOMPOSITION: 'text-primary'
    };
    return classes[type] || 'text-muted';
  }

  getStockStatusClass(quantite: number, seuil: number): string {
    if (quantite <= 0) return 'badge-danger';
    if (quantite <= seuil) return 'badge-warning';
    return 'badge-success';
  }

  getStockStatusText(quantite: number, seuil: number): string {
    if (quantite <= 0) return 'Rupture';
    if (quantite <= seuil) return 'Faible';
    return 'Normal';
  }

  private withUser<T extends { utilisateurId?: number }>(payload: T): T {
    return { ...payload, utilisateurId: payload.utilisateurId || this.auth.getUserId() };
  }

  private extractList<T>(response: any): T[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.mouvements)) return response.mouvements;
    if (Array.isArray(response?.produits)) return response.produits;
    return [];
  }

  private handleError(error: any, context: string): Observable<never> {
    let message = `Impossible de ${context}`;
    if (error.status === 0) message = 'Impossible de se connecter au serveur';
    if (error.status === 409) message = error.error?.message || 'Stock insuffisant';
    if (error.error?.message) message = error.error.message;
    if (typeof error.error === 'string') message = error.error;
    return throwError(() => new Error(message));
  }
}
