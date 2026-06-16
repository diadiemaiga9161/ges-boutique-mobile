import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface DetteAncienne {
  id: number;
  clientId: number;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  montantInitial: number;
  montantRestant: number;
  montantPaye: number;
  dateCredit: string;
  description?: string;
  estReglee: boolean;
  dateCreation?: string;
  dateDernierReglement?: string;
}

export interface DetteAncienneRequest {
  clientId: number;
  montant: number;
  dateCredit: string;
  description?: string;
}

export interface ReglementDetteRequest {
  detteId: number;
  montantPaye: number;
  utilisateurId?: number;
  modePaiement: string;
  referencePaiement?: string;
  observations?: string;
}

export interface ReglementDette {
  id: number;
  detteId: number;
  montantPaye: number;
  montantRestantApres: number;
  dateReglement: string;
  utilisateurId?: number;
  utilisateurNom?: string;
  modePaiement: string;
  referencePaiement?: string;
  observations?: string;
}

export interface StatistiquesDettes {
  totalDettesInitiales: number;
  totalDettesRestantes: number;
  totalReglementsEffectues: number;
  nombreDettesNonReglees: number;
  nombreDettesReglees: number;
  totalReglementsDuJour: number;
}

@Injectable({ providedIn: 'root' })
export class DetteAncienneService {
  private readonly apiUrl = `${environment.apiUrl}/dettes-anciennes`;

  constructor(private http: HttpClient) {}

  creerDette(request: DetteAncienneRequest): Observable<DetteAncienne> {
    return this.http.post<any>(this.apiUrl, request).pipe(map(response => this.extractOne(response)), catchError(error => this.handleError(error, 'créer la dette')));
  }

  modifierDette(id: number, request: DetteAncienneRequest): Observable<DetteAncienne> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request).pipe(map(response => this.extractOne(response)), catchError(error => this.handleError(error, 'modifier la dette')));
  }

  getDetteById(id: number): Observable<DetteAncienne> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(map(response => this.extractOne(response)), catchError(error => this.handleError(error, 'récupérer la dette')));
  }

  getAllDettes(): Observable<DetteAncienne[]> {
    return this.http.get<any>(this.apiUrl).pipe(map(response => this.extractList(response)), catchError(error => this.handleError(error, 'récupérer les dettes')));
  }

  getDettesParClient(clientId: number): Observable<DetteAncienne[]> {
    return this.http.get<any>(`${this.apiUrl}/client/${clientId}`).pipe(map(response => this.extractList(response)), catchError(error => this.handleError(error, 'récupérer les dettes du client')));
  }

  getDettesNonReglees(): Observable<DetteAncienne[]> {
    return this.http.get<any>(`${this.apiUrl}/non-reglees`).pipe(map(response => this.extractList(response)), catchError(error => this.handleError(error, 'récupérer les dettes non réglées')));
  }

  getDettesReglees(): Observable<DetteAncienne[]> {
    return this.http.get<any>(`${this.apiUrl}/reglees`).pipe(map(response => this.extractList(response)), catchError(error => this.handleError(error, 'récupérer les dettes réglées')));
  }

  rechercherDettes(query: string): Observable<DetteAncienne[]> {
    const params = new HttpParams().set('query', query);
    return this.http.get<any>(`${this.apiUrl}/recherche`, { params }).pipe(map(response => this.extractList(response)), catchError(error => this.handleError(error, 'rechercher les dettes')));
  }

  supprimerDette(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(map(() => undefined), catchError(error => this.handleError(error, 'supprimer la dette')));
  }

  enregistrerReglement(request: ReglementDetteRequest): Observable<ReglementDette> {
    return this.http.post<any>(`${this.apiUrl}/reglement`, request).pipe(map(response => response?.reglement || response?.data || response), catchError(error => this.handleError(error, 'enregistrer le règlement')));
  }

  getHistoriqueReglements(detteId: number): Observable<ReglementDette[]> {
    return this.http.get<any>(`${this.apiUrl}/${detteId}/reglements`).pipe(map(response => this.extractList(response, 'reglements')), catchError(error => this.handleError(error, 'récupérer les règlements')));
  }

  getReglementsParPeriode(dateDebut: string, dateFin: string): Observable<ReglementDette[]> {
    const params = new HttpParams().set('dateDebut', dateDebut).set('dateFin', dateFin);
    return this.http.get<any>(`${this.apiUrl}/reglements/periode`, { params }).pipe(map(response => this.extractList(response, 'reglements')), catchError(error => this.handleError(error, 'récupérer les règlements')));
  }

  getStatistiquesGlobales(): Observable<StatistiquesDettes> {
    return this.http.get<any>(`${this.apiUrl}/statistiques/globales`).pipe(map(response => response?.statistiques || response?.data || response), catchError(error => this.handleError(error, 'récupérer les statistiques')));
  }

  getMontantRestantTotal(dettes: DetteAncienne[]): number {
    return dettes.reduce((sum, dette) => sum + Number(dette.montantRestant || 0), 0);
  }

  getPourcentagePaye(dette: DetteAncienne): number {
    if (!dette.montantInitial) return 0;
    return ((dette.montantPaye || 0) / dette.montantInitial) * 100;
  }

  getStatutDette(dette: DetteAncienne): string {
    if (dette.estReglee) return 'Réglée';
    if (dette.montantRestant === dette.montantInitial) return 'Non payée';
    return 'Partielle';
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
  }

  private extractOne(response: any): DetteAncienne {
    return response?.dette || response?.data || response;
  }

  private extractList(response: any, key = 'dettes'): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  private handleError(error: any, context: string): Observable<never> {
    return throwError(() => new Error(error.error?.message || error.error?.error || `Impossible de ${context}`));
  }
}
