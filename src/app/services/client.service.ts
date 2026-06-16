import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
// apiUrl = /api/clients  |  avancesUrl = /api/avances (endpoint séparé côté backend)

export interface Client {
  id?: number;
  nom: string;
  prenom?: string;
  numeroTelephone?: string;
  telephone?: string;
  adresse?: string;
  email?: string;
  dateCreation?: string;
  soldeAvance?: number;
}

export interface AvanceClient {
  id?: number;
  clientNom: string;
  clientTelephone?: string;
  montant: number;
  montantUtilise: number;
  montantDisponible: number;
  dateDepot: string;
  motif?: string;
  statut: 'DISPONIBLE' | 'UTILISE_PARTIELLEMENT' | 'EPUISE';
}

export interface AvanceClientRequest {
  clientNom: string;
  clientTelephone?: string;
  montant: number;
  motif?: string;
  utilisateurId?: number;
  modePaiement?: string;
  referencePaiement?: string;
}

export interface HistoriqueAvanceResponse {
  clientNom: string;
  soldeDisponible: number;
  historique: AvanceClient[];
  totalDepose: number;
  totalUtilise: number;
}

export interface TopClient {
  client: Client;
  nombreAchats: number;
  montantTotal: number;
}

@Injectable({
  providedIn: 'root'
})
export class ClientService {
  private readonly apiUrl = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Client[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => this.extractList(response).map(client => this.normalize(client))),
      catchError(error => this.handleError(error, 'récupérer les clients'))
    );
  }

  getById(id: number): Observable<Client> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => this.normalize(this.extractOne(response))),
      catchError(error => this.handleError(error, 'récupérer le client'))
    );
  }

  getByTelephone(telephone: string): Observable<Client | null> {
    return this.http.get<any>(`${this.apiUrl}/telephone/${encodeURIComponent(telephone)}`).pipe(
      map(response => this.normalize(this.extractOne(response))),
      catchError(() => [null])
    );
  }

  search(query: string): Observable<Client[]> {
    if (!query.trim()) return this.getAll();
    const params = new HttpParams().set('query', query.trim());
    return this.http.get<any>(`${this.apiUrl}/recherche`, { params }).pipe(
      map(response => this.extractList(response).map(client => this.normalize(client))),
      catchError(error => this.handleError(error, 'rechercher les clients'))
    );
  }

  create(client: Client): Observable<Client> {
    return this.http.post<any>(this.apiUrl, this.toBackend(client)).pipe(
      map(response => this.normalize(this.extractOne(response))),
      catchError(error => this.handleError(error, 'créer le client'))
    );
  }

  update(id: number, client: Client): Observable<Client> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, this.toBackend(client)).pipe(
      map(response => this.normalize(this.extractOne(response))),
      catchError(error => this.handleError(error, 'modifier le client'))
    );
  }

  delete(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => undefined),
      catchError(error => this.handleError(error, 'supprimer le client'))
    );
  }

  getTopClients(): Observable<TopClient[]> {
    return this.http.get<any>(`${this.apiUrl}/top-clients`).pipe(
      map(response => response?.topClients || response?.data || []),
      catchError(error => this.handleError(error, 'récupérer les meilleurs clients'))
    );
  }

  getSoldeAvance(clientNom: string, clientTelephone?: string): Observable<{ soldeDisponible: number }> {
    let params = new HttpParams().set('clientNom', clientNom);
    if (clientTelephone) params = params.set('clientTelephone', clientTelephone);
    return this.http.get<any>(`${environment.apiUrl}/avances/solde`, { params }).pipe(
      map(response => ({ soldeDisponible: Number(response?.soldeDisponible ?? response?.montantDisponible ?? 0) })),
      catchError(() => [{ soldeDisponible: 0 }])
    );
  }

  enregistrerAvance(request: AvanceClientRequest): Observable<{ message: string; soldeDisponible: number }> {
    return this.http.post<any>(`${environment.apiUrl}/avances`, request).pipe(
      map(response => ({
        message: response?.message || 'Avance enregistrée',
        soldeDisponible: Number(response?.soldeDisponible ?? 0)
      })),
      catchError(error => this.handleError(error, 'enregistrer l\'avance'))
    );
  }

  getHistoriqueAvances(clientNom: string, clientTelephone?: string): Observable<HistoriqueAvanceResponse> {
    let params = new HttpParams().set('clientNom', clientNom);
    if (clientTelephone) params = params.set('clientTelephone', clientTelephone);
    return this.http.get<any>(`${environment.apiUrl}/avances/historique`, { params }).pipe(
      map(response => {
        const raw = response?.data || response;
        return {
          clientNom: raw?.clientNom || clientNom,
          soldeDisponible: Number(raw?.soldeDisponible ?? 0),
          totalDepose: Number(raw?.totalDepose ?? 0),
          totalUtilise: Number(raw?.totalUtilise ?? 0),
          historique: Array.isArray(raw?.historique) ? raw.historique
            : Array.isArray(raw?.avances) ? raw.avances
            : Array.isArray(raw) ? raw
            : []
        } as HistoriqueAvanceResponse;
      }),
      catchError(error => this.handleError(error, 'récupérer l\'historique des avances'))
    );
  }

  getFullName(client: Client): string {
    return [client.prenom, client.nom].filter(Boolean).join(' ').trim() || client.telephone || '';
  }

  private normalize(client: Client): Client {
    if (!client) return { nom: '', prenom: '' };
    return {
      ...client,
      telephone: client.telephone || client.numeroTelephone || '',
      numeroTelephone: client.numeroTelephone || client.telephone || ''
    };
  }

  private toBackend(client: Client): any {
    const { telephone, ...rest } = client as any;
    return {
      ...rest,
      numeroTelephone: client.numeroTelephone || client.telephone || ''
    };
  }

  private extractList(response: any): Client[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.clients)) return response.clients;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  private extractOne(response: any): Client {
    return response?.client || response?.data || response;
  }

  private handleError(error: any, context: string): Observable<never> {
    let message = `Impossible de ${context}`;
    if (error.status === 0) message = 'Impossible de se connecter au serveur';
    if (error.error?.message) message = error.error.message;
    if (typeof error.error === 'string') message = error.error;
    return throwError(() => new Error(message));
  }
}
