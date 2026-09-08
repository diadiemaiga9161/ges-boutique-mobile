import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Nouvelle fonctionnalité "Vente en gros / détail" (clé avancée VENTE_GROS_DETAIL) —
 * alternative simple à l'ancien système ProduitNiveau (voir produit-niveau.service.ts,
 * laissé intact et non utilisé ici). Le produit garde un stock UNIQUE (Produit.quantite) ;
 * une UniteVente définit juste un facteur de conversion vers l'unité de base du produit
 * (Produit.uniteBase) ainsi qu'un prix de vente/achat propre. Pas de stock séparé, pas
 * d'étape de décomposition : la déduction se fait directement sur le stock unique au
 * moment de la vente (quantité vendue × facteurBase).
 */
export interface UniteVente {
  id?: number;
  produitId?: number;
  nom: string;
  facteurBase: number;   // facteur total vers l'unité de base du produit (calculé par le serveur)
  prixVente: number;
  prixAchat: number;
  ordre?: number;
}

/** Corps d'ajout/modification — le formulaire ne doit JAMAIS calculer lui-même le facteur
 *  total : on envoie `uniteReferenceId` (id d'une autre unité déjà créée, omis si la
 *  référence choisie est l'unité de base elle-même) + `facteurRelatif` (ex: "1 Carton =
 *  facteurRelatif Cartouches"), et le serveur calcule facteurBase tout seul. */
export interface UniteVenteRequest {
  nom: string;
  prixVente: number;
  prixAchat: number;
  ordre?: number;
  uniteReferenceId?: number;
  facteurRelatif: number;
}

@Injectable({ providedIn: 'root' })
export class UniteVenteService {

  private readonly apiUrl = `${environment.apiUrl}/produits`;

  constructor(private http: HttpClient) {}

  getUnites(produitId: number): Observable<UniteVente[]> {
    return this.http.get<any>(`${this.apiUrl}/${produitId}/unites-vente`).pipe(
      map(r => r?.unites || []),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur chargement des unités de vente')))
    );
  }

  creer(produitId: number, unite: UniteVenteRequest): Observable<UniteVente> {
    return this.http.post<any>(`${this.apiUrl}/${produitId}/unites-vente`, unite).pipe(
      map(r => r?.unite || r),
      catchError(e => throwError(() => new Error(e?.error?.message || "Erreur création de l'unité de vente")))
    );
  }

  modifier(id: number, unite: UniteVenteRequest): Observable<UniteVente> {
    return this.http.put<any>(`${this.apiUrl}/unites-vente/${id}`, unite).pipe(
      map(r => r?.unite || r),
      catchError(e => throwError(() => new Error(e?.error?.message || "Erreur modification de l'unité de vente")))
    );
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/unites-vente/${id}`).pipe(
      map(() => void 0),
      catchError(e => throwError(() => new Error(e?.error?.message || "Erreur suppression de l'unité de vente")))
    );
  }
}
