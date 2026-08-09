import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ProduitNiveau {
  id?: number;
  produitId?: number;
  nom: string;
  ordre?: number;       // gardé pour compatibilité, optionnel
  parentId?: number | null;    // null = niveau racine (le plus grand emballage)
  facteur: number;      // combien de CE niveau dans 1 unité du parent
  prixAchat: number;
  prixVente: number;
  stock?: number;
}

@Injectable({ providedIn: 'root' })
export class ProduitNiveauService {

  private readonly apiUrl = `${environment.apiUrl}/produits`;

  constructor(private http: HttpClient) {}

  getNiveaux(produitId: number): Observable<ProduitNiveau[]> {
    return this.http.get<any>(`${this.apiUrl}/${produitId}/niveaux`).pipe(
      map(r => r.niveaux || []),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur chargement niveaux')))
    );
  }

  // Niveaux + stock du produit "principal" pas encore décomposé (ex: cartons
  // fermés) — parent implicite du niveau racine (parentId = null), nécessaire
  // pour que disponibleNiveau() calcule la vraie disponibilité en cascade.
  getNiveauxEtPrincipal(produitId: number): Observable<{ niveaux: ProduitNiveau[]; quantitePrincipale: number }> {
    return this.http.get<any>(`${this.apiUrl}/${produitId}/niveaux`).pipe(
      map(r => ({ niveaux: r.niveaux || [], quantitePrincipale: r.quantitePrincipale ?? 0 })),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur chargement niveaux')))
    );
  }

  creer(produitId: number, niveau: Partial<ProduitNiveau>): Observable<ProduitNiveau> {
    return this.http.post<any>(`${this.apiUrl}/${produitId}/niveaux`, niveau).pipe(
      map(r => r.niveau),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur création niveau')))
    );
  }

  modifier(id: number, niveau: Partial<ProduitNiveau>): Observable<ProduitNiveau> {
    return this.http.put<any>(`${this.apiUrl}/niveaux/${id}`, niveau).pipe(
      map(r => r.niveau),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur modification niveau')))
    );
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/niveaux/${id}`).pipe(
      map(() => void 0),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur suppression niveau')))
    );
  }

  supprimerTous(produitId: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${produitId}/niveaux`).pipe(
      map(() => void 0),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur')))
    );
  }

  ajusterStock(id: number, stock: number): Observable<ProduitNiveau> {
    return this.http.patch<any>(`${this.apiUrl}/niveaux/${id}/stock`, { stock }).pipe(
      map(r => r.niveau),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur ajustement stock')))
    );
  }

  decomposer(id: number): Observable<{ niveaux: ProduitNiveau[], produitQuantite: number, message: string }> {
    return this.http.post<any>(`${this.apiUrl}/niveaux/${id}/decomposer`, {}).pipe(
      map(r => r),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Décomposition impossible')))
    );
  }

  // Retourne la chaine depuis la racine jusqu'à un niveau donné
  buildNiveauxChaine(niveaux: ProduitNiveau[]): ProduitNiveau[] {
    const roots = niveaux.filter(n => !n.parentId);
    const result: ProduitNiveau[] = [];
    const addWithChildren = (n: ProduitNiveau) => {
      result.push(n);
      niveaux.filter(c => c.parentId === n.id).forEach(addWithChildren);
    };
    roots.forEach(addWithChildren);
    return result;
  }

  // Nom du parent pour affichage "1 Sachet = 12 Pièces"
  nomParent(niveau: ProduitNiveau, niveaux: ProduitNiveau[]): string {
    if (!niveau.parentId) return '';
    return niveaux.find(n => n.id === niveau.parentId)?.nom || '';
  }

  // Libellé dynamique du facteur
  labelFacteur(niveau: ProduitNiveau, niveaux: ProduitNiveau[]): string {
    const parentNom = this.nomParent(niveau, niveaux);
    if (!parentNom) return 'Quantité par unité supérieure';
    return `Combien de ${niveau.nom || '...'} dans 1 ${parentNom} ?`;
  }
}
