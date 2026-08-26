import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type StatutObjectifVendeur = 'ATTEINT' | 'NON_ATTEINT';

export interface ObjectifVendeur {
  id: number;
  vendeurId: number;
  vendeurNom: string;
  semaine: number;
  annee: number;
  objectifNombreVentes: number;
  bonusMontant: number;
  nombreVentesAtteint: number;
  statut: StatutObjectifVendeur;
  bonusValide: boolean;
  observation?: string;
  dateValidation?: string;
  dateCreation: string;
}

export interface ObjectifVendeurRequest {
  vendeurId: number;
  semaine: number;
  annee: number;
  objectifNombreVentes: number;
  bonusMontant: number;
  observation?: string;
}

@Injectable({ providedIn: 'root' })
export class ObjectifVendeurService {
  private readonly url = `${environment.apiUrl}/objectifs-vendeur`;

  constructor(private http: HttpClient) {}

  creer(request: ObjectifVendeurRequest): Observable<ObjectifVendeur> {
    return this.http.post<ObjectifVendeur>(this.url, request);
  }

  modifier(id: number, request: ObjectifVendeurRequest): Observable<ObjectifVendeur> {
    return this.http.put<ObjectifVendeur>(`${this.url}/${id}`, request);
  }

  getTous(): Observable<ObjectifVendeur[]> {
    return this.http.get<ObjectifVendeur[]>(this.url);
  }

  getById(id: number): Observable<ObjectifVendeur> {
    return this.http.get<ObjectifVendeur>(`${this.url}/${id}`);
  }

  getParSemaineAnnee(semaine: number, annee: number): Observable<ObjectifVendeur[]> {
    const params = new HttpParams().set('semaine', semaine).set('annee', annee);
    return this.http.get<ObjectifVendeur[]>(`${this.url}/semaine`, { params });
  }

  getParVendeur(vendeurId: number): Observable<ObjectifVendeur[]> {
    return this.http.get<ObjectifVendeur[]>(`${this.url}/vendeur/${vendeurId}`);
  }

  getParAnnee(annee: number): Observable<ObjectifVendeur[]> {
    const params = new HttpParams().set('annee', annee);
    return this.http.get<ObjectifVendeur[]>(`${this.url}/annee`, { params });
  }

  valider(id: number): Observable<ObjectifVendeur> {
    return this.http.patch<ObjectifVendeur>(`${this.url}/${id}/valider`, {});
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  formatMontant(m: number): string {
    const n = Math.round(m || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
  }

  getPourcentageAtteinte(o: ObjectifVendeur): number {
    if (!o.objectifNombreVentes) return 0;
    return Math.min(Math.round((o.nombreVentesAtteint / o.objectifNombreVentes) * 100), 100);
  }
}
