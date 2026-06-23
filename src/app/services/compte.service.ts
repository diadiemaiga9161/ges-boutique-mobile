import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Compte {
  id: number;
  nomBanque: string;
  numeroCompte?: string;
  agence?: string;
  titulaire?: string;
  soldeInitial: number;
  soldeActuel: number;
  actif: boolean;
  description?: string;
  dateCreation?: string;
}

export interface CompteRequest {
  nomBanque: string;
  numeroCompte?: string;
  agence?: string;
  titulaire?: string;
  soldeInitial: number;
  description?: string;
}

export type TypeOperationCompte = 'VERSEMENT' | 'RETRAIT' | 'CHEQUE' | 'FRAIS' | 'BON_CAISSE' | 'PAIEMENT_FOURNISSEUR' | 'AVANCE_FOURNISSEUR';

export interface OperationCompteRequest {
  compteId: number;
  type: TypeOperationCompte;
  montant: number;
  motif?: string;
  reference?: string;
  utilisateurId?: number;
}

export interface OperationCompte {
  id: number;
  type: TypeOperationCompte;
  montant: number;
  soldeAvant: number;
  soldeApres: number;
  motif?: string;
  reference?: string;
  dateOperation: string;
}

export interface TransfertCaisseBanqueRequest {
  compteId: number;
  montant: number;
  motif: string;
  utilisateurId?: number;
  reference?: string;
}

@Injectable({ providedIn: 'root' })
export class CompteService {
  private readonly apiUrl = `${environment.apiUrl}/comptes`;

  constructor(private http: HttpClient) {}

  getTousLesComptes(): Observable<Compte[]> {
    return this.http.get<Compte[]>(this.apiUrl).pipe(catchError(error => this.handleError(error, 'charger les comptes')));
  }

  getCompteById(id: number): Observable<Compte> {
    return this.http.get<Compte>(`${this.apiUrl}/${id}`).pipe(catchError(error => this.handleError(error, 'charger le compte')));
  }

  creerCompte(request: CompteRequest): Observable<Compte> {
    return this.http.post<Compte>(this.apiUrl, request).pipe(catchError(error => this.handleError(error, 'créer le compte')));
  }

  modifierCompte(id: number, request: CompteRequest): Observable<Compte> {
    return this.http.put<Compte>(`${this.apiUrl}/${id}`, request).pipe(catchError(error => this.handleError(error, 'modifier le compte')));
  }

  enregistrerOperation(request: OperationCompteRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/operation`, request).pipe(catchError(error => this.handleError(error, "enregistrer l'opération")));
  }

  getHistoriqueOperations(compteId: number): Observable<OperationCompte[]> {
    return this.http.get<OperationCompte[]>(`${this.apiUrl}/${compteId}/operations`).pipe(catchError(error => this.handleError(error, "charger l'historique")));
  }

  transfererCaisseVersBanque(request: TransfertCaisseBanqueRequest): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/caisse/transferer-vers-banque`, request).pipe(catchError(error => this.handleError(error, 'transférer caisse vers banque')));
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
  }

  private handleError(error: any, context: string): Observable<never> {
    return throwError(() => new Error(error.error?.message || error.error?.error || `Impossible de ${context}`));
  }
}
