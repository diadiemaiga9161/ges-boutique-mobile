import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type TypeBonus = 'RISTOURNE' | 'BONUS_VOLUME' | 'PRIME_OBJECTIF' | 'BONUS_ACHAT';

export interface BonusFournisseur {
  id?: number;
  fournisseurId: number;
  fournisseurNom?: string;
  type: TypeBonus;
  typeLibelle?: string;
  montant: number;
  produitId?: number;
  produitNom?: string;
  quantiteProduit?: number;
  date: string;
  description?: string;
  dateCreation?: string;
}

export interface BonusFournisseurRequest {
  fournisseurId: number;
  type: TypeBonus;
  montant: number;
  produitId?: number;
  quantiteProduit?: number;
  date: string;
  description?: string;
}

export interface BonusStats {
  mois: number;
  annee: number;
  totalMois: number;
  totalAnnee: number;
  nombreMois: number;
  lignes: BonusFournisseur[];
}

export interface ResultatNet {
  periode: string;
  dateDebut: string;
  dateFin: string;
  benefices: number;
  bonusFournisseurs: number;
  depenses: number;
  resultatNet: number;
  etat: 'GAIN' | 'PERTE';
}

@Injectable({ providedIn: 'root' })
export class BonusFournisseurService {

  private readonly apiUrl = `${environment.apiUrl}/bonus-fournisseurs`;
  private readonly resultatUrl = `${environment.apiUrl}/resultat-net`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<BonusFournisseur[]> {
    return this.http.get<BonusFournisseur[]>(this.apiUrl).pipe(
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur chargement bonus')))
    );
  }

  getStatistiques(mois?: number, annee?: number): Observable<BonusStats> {
    let params = new HttpParams();
    if (mois) params = params.set('mois', mois.toString());
    if (annee) params = params.set('annee', annee.toString());
    return this.http.get<BonusStats>(`${this.apiUrl}/statistiques`, { params }).pipe(
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur stats')))
    );
  }

  creer(request: BonusFournisseurRequest): Observable<BonusFournisseur> {
    return this.http.post<BonusFournisseur>(this.apiUrl, request).pipe(
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur création bonus')))
    );
  }

  modifier(id: number, request: BonusFournisseurRequest): Observable<BonusFournisseur> {
    return this.http.put<BonusFournisseur>(`${this.apiUrl}/${id}`, request).pipe(
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur modification')))
    );
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur suppression')))
    );
  }

  getResultatMensuel(mois?: number, annee?: number): Observable<ResultatNet> {
    let params = new HttpParams();
    if (mois) params = params.set('mois', mois.toString());
    if (annee) params = params.set('annee', annee.toString());
    return this.http.get<ResultatNet>(`${this.resultatUrl}/mensuel`, { params }).pipe(
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur résultat')))
    );
  }

  getResultatJournalier(date?: string): Observable<ResultatNet> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<ResultatNet>(`${this.resultatUrl}/journalier`, { params }).pipe(
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur résultat')))
    );
  }

  getResultatAnnuel(annee?: number): Observable<ResultatNet> {
    let params = new HttpParams();
    if (annee) params = params.set('annee', annee.toString());
    return this.http.get<ResultatNet>(`${this.resultatUrl}/annuel`, { params }).pipe(
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur résultat')))
    );
  }

  libelleType(type: TypeBonus): string {
    const map: Record<TypeBonus, string> = {
      RISTOURNE: 'Ristourne',
      BONUS_VOLUME: 'Bonus Volume',
      PRIME_OBJECTIF: 'Prime Objectif',
      BONUS_ACHAT: 'Bonus Achat'
    };
    return map[type] || type;
  }

  formatPrice(v: number): string {
    return new Intl.NumberFormat('fr-FR').format(v) + ' FCFA';
  }
}
