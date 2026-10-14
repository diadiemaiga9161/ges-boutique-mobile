import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { OffreEnCours } from '../utils/offres-quantite.util';

export interface OffreQuantite {
  id: number;
  produitId: number;
  produitNom: string;
  prixNormal: number;
  prixAchat: number;
  quantite: number;
  prix: number;
  economie: number;
  dateDebut: string | null;
  dateFin: string | null;
  active: boolean;
  enCours: boolean;
  creePar: string | null;
}

const CLE_CACHE = 'offres_quantite_en_cours';

/**
 * Offres par quantité (fonctionnalité OFFRES_QUANTITE) : réglées par le gérant, appliquées
 * par le serveur. La dernière liste est gardée sur le téléphone pour que le panier affiche
 * le bon total même hors connexion ; le serveur recalcule de toute façon à l'envoi.
 */
@Injectable({ providedIn: 'root' })
export class OffreQuantiteService {
  private readonly api = `${environment.apiUrl}/offres-quantite`;
  private liste: OffreEnCours[] = this.lireCache();

  constructor(private http: HttpClient) {}

  get enCours(): OffreEnCours[] {
    return this.liste;
  }

  chargerEnCours(): Observable<OffreEnCours[]> {
    return this.http.get<OffreEnCours[]>(`${this.api}/en-cours`).pipe(
      tap(l => this.memoriser(l || [])),
      catchError(() => of(this.liste))
    );
  }

  /** Fonctionnalité coupée : on oublie les offres gardées. */
  vider(): void {
    this.memoriser([]);
  }

  lister(): Observable<OffreQuantite[]> {
    return this.http.get<OffreQuantite[]>(this.api);
  }

  enregistrer(offre: Partial<OffreQuantite>): Observable<OffreQuantite> {
    const corps = {
      produitId: offre.produitId, quantite: offre.quantite, prix: offre.prix,
      dateDebut: offre.dateDebut || null, dateFin: offre.dateFin || null, active: offre.active !== false
    };
    const appel = offre.id
      ? this.http.put<OffreQuantite>(`${this.api}/${offre.id}`, corps)
      : this.http.post<OffreQuantite>(this.api, corps);
    return appel.pipe(tap(() => this.chargerEnCours().subscribe()));
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`).pipe(tap(() => this.chargerEnCours().subscribe()));
  }

  private memoriser(l: OffreEnCours[]): void {
    this.liste = l;
    try { localStorage.setItem(CLE_CACHE, JSON.stringify(l)); } catch { /* stockage indisponible */ }
  }

  private lireCache(): OffreEnCours[] {
    try {
      const brut = localStorage.getItem(CLE_CACHE);
      const l = brut ? JSON.parse(brut) : [];
      return Array.isArray(l) ? l : [];
    } catch {
      return [];
    }
  }
}
