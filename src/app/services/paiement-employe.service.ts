import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type StatutPaiementEmploye = 'PAYE' | 'ANNULE';

export interface PaiementEmploye {
  id: number;
  employeId: number;
  employeNomComplet: string;
  employePoste: string;
  salaireMensuel: number;
  montant: number;
  nombreMois: number;
  periodeDebut: string;
  periodeFin?: string;
  datePaiement: string;
  statut: StatutPaiementEmploye;
  utilisateurId?: number;
  operationCaisseId?: number;
  motifAnnulation?: string;
  dateAnnulation?: string;
  observation?: string;
}

export interface PaiementEmployeRequest {
  employeId: number;
  nombreMois: number;
  periodeDebut: string;
  periodeFin?: string;
  observation?: string;
  utilisateurId?: number;
}

export interface StatsPaiementEmploye {
  totalPaiements: number;
  totalPaies: number;
  totalAnnules: number;
  montantTotalPaye: number;
}

@Injectable({ providedIn: 'root' })
export class PaiementEmployeService {
  private readonly url = `${environment.apiUrl}/paiements-employe`;

  constructor(private http: HttpClient) {}

  payer(request: PaiementEmployeRequest): Observable<PaiementEmploye> {
    return this.http.post<PaiementEmploye>(this.url, request);
  }

  annuler(id: number, motif: string, utilisateurId?: number): Observable<PaiementEmploye> {
    let params = new HttpParams().set('motif', motif);
    if (utilisateurId) params = params.set('utilisateurId', utilisateurId);
    return this.http.patch<PaiementEmploye>(`${this.url}/${id}/annuler`, {}, { params });
  }

  getById(id: number): Observable<PaiementEmploye> {
    return this.http.get<PaiementEmploye>(`${this.url}/${id}`);
  }

  getTous(): Observable<PaiementEmploye[]> {
    return this.http.get<PaiementEmploye[]>(this.url);
  }

  getParEmploye(employeId: number): Observable<PaiementEmploye[]> {
    return this.http.get<PaiementEmploye[]>(`${this.url}/employe/${employeId}`);
  }

  getActifs(): Observable<PaiementEmploye[]> {
    return this.http.get<PaiementEmploye[]>(`${this.url}/actifs`);
  }

  getStatistiques(): Observable<StatsPaiementEmploye> {
    return this.http.get<StatsPaiementEmploye>(`${this.url}/statistiques`);
  }
}
