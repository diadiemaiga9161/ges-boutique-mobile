import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type StatutObjectif = 'ATTEINT' | 'NON_ATTEINT';

export interface ObjectifFournisseur {
  id: number;
  fournisseurId: number;
  fournisseurNom: string;
  produitId?: number;
  produitNom?: string;
  mois: number;
  annee: number;
  objectifQuantite: number;
  bonusParUnite: number;
  quantiteAtteinte: number;
  bonusCalcule: number;
  quantiteBonusRecue: number;
  statut: StatutObjectif;
  observation?: string;
  stockAjoute: boolean;
  dateValidation?: string;
  dateCreation: string;
}

export interface ObjectifFournisseurRequest {
  fournisseurId: number;
  produitId?: number;
  mois: number;
  annee: number;
  objectifQuantite: number;
  bonusParUnite: number;
  quantiteAtteinte?: number;
  quantiteBonusRecue?: number;
  observation?: string;
}

export interface StatsObjectif {
  mois: number;
  annee: number;
  totalObjectifs: number;
  objectifsAtteints: number;
  objectifsNonAtteints: number;
  totalBonusCalcule: number;
  totalQuantiteBonusRecue: number;
}

export const MOIS_LABELS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

@Injectable({ providedIn: 'root' })
export class ObjectifFournisseurService {
  private readonly url = `${environment.apiUrl}/objectifs-fournisseur`;

  constructor(private http: HttpClient) {}

  creer(request: ObjectifFournisseurRequest): Observable<ObjectifFournisseur> {
    return this.http.post<ObjectifFournisseur>(this.url, request);
  }

  modifier(id: number, request: ObjectifFournisseurRequest): Observable<ObjectifFournisseur> {
    return this.http.put<ObjectifFournisseur>(`${this.url}/${id}`, request);
  }

  getTous(): Observable<ObjectifFournisseur[]> {
    return this.http.get<ObjectifFournisseur[]>(this.url);
  }

  getParMoisAnnee(mois: number, annee: number): Observable<ObjectifFournisseur[]> {
    const params = new HttpParams().set('mois', mois).set('annee', annee);
    return this.http.get<ObjectifFournisseur[]>(`${this.url}/mois`, { params });
  }

  valider(id: number): Observable<ObjectifFournisseur> {
    return this.http.patch<ObjectifFournisseur>(`${this.url}/${id}/valider`, {});
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  getStatistiques(mois: number, annee: number): Observable<StatsObjectif> {
    const params = new HttpParams().set('mois', mois).set('annee', annee);
    return this.http.get<StatsObjectif>(`${this.url}/statistiques`, { params });
  }

  formatMontant(m: number): string {
    return new Intl.NumberFormat('fr-FR').format(m || 0) + ' FCFA';
  }

  getMoisLabel(mois: number): string {
    return MOIS_LABELS[mois] || '';
  }

  getPourcentageAtteinte(o: ObjectifFournisseur): number {
    if (!o.objectifQuantite) return 0;
    return Math.min(Math.round((o.quantiteAtteinte / o.objectifQuantite) * 100), 100);
  }
}
