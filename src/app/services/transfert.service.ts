import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const URL = `${environment.apiUrl}/transferts`;

export interface BoutiquePartenaire { id?: number; nom: string; url: string; actif: boolean; }
export interface LigneTransfert { id?: number; produitId: number; produitNom: string; quantite: number; prixUnitaire?: number; }
export interface HistoriqueTransfert { action: string; description: string; effectuePar: string; dateAction: string; }
export interface TransfertStock {
  id?: number; numeroTransfert?: string;
  boutiqueSourceNom: string; boutiqueDestNom: string;
  statut: string; typePaiement: string; notes?: string;
  dateCreation?: string; creePar?: string;
  lignes: LigneTransfert[]; historique?: HistoriqueTransfert[];
}
export interface TransfertRequest {
  boutiqueDestId: number; typePaiement: string; notes?: string;
  lignes: { produitId: number; produitNom: string; quantite: number; prixUnitaire?: number }[];
}

@Injectable({ providedIn: 'root' })
export class TransfertService {
  constructor(private http: HttpClient) {}

  getPartenaires(): Observable<BoutiquePartenaire[]> { return this.http.get<BoutiquePartenaire[]>(`${URL}/partenaires`); }
  ajouterPartenaire(p: BoutiquePartenaire): Observable<BoutiquePartenaire> { return this.http.post<BoutiquePartenaire>(`${URL}/partenaires`, p); }
  modifierPartenaire(id: number, p: BoutiquePartenaire): Observable<BoutiquePartenaire> { return this.http.put<BoutiquePartenaire>(`${URL}/partenaires/${id}`, p); }
  supprimerPartenaire(id: number): Observable<void> { return this.http.delete<void>(`${URL}/partenaires/${id}`); }
  getTout(): Observable<TransfertStock[]> { return this.http.get<TransfertStock[]>(URL); }
  getById(id: number): Observable<TransfertStock> { return this.http.get<TransfertStock>(`${URL}/${id}`); }
  creer(req: TransfertRequest): Observable<TransfertStock> { return this.http.post<TransfertStock>(URL, req); }
  modifier(id: number, req: TransfertRequest): Observable<TransfertStock> { return this.http.put<TransfertStock>(`${URL}/${id}`, req); }
  confirmer(id: number): Observable<TransfertStock> { return this.http.put<TransfertStock>(`${URL}/${id}/confirmer`, {}); }
  annuler(id: number, motif?: string): Observable<TransfertStock> { return this.http.put<TransfertStock>(`${URL}/${id}/annuler`, { motif }); }
}
