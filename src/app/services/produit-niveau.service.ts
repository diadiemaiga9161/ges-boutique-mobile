import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ProduitNiveau {
  id?: number;
  produitId?: number;
  nom: string;
  ordre: number;
  facteur: number;
  prixAchat: number;
  prixVente: number;
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

  // Calcule le facteur total d'un niveau par rapport à l'unité de base
  facteurTotal(niveaux: ProduitNiveau[], ordre: number): number {
    const sorted = [...niveaux].sort((a, b) => a.ordre - b.ordre);
    let total = 1;
    for (const n of sorted) {
      if (n.ordre < ordre) total *= n.facteur;
    }
    return total;
  }
}
