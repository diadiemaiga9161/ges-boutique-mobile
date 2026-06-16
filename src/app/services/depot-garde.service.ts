import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type StatutDepot = 'ACTIF' | 'CLOTURE';

export interface DepotClient {
  id: number;
  nom: string;
  prenom?: string;
  nomComplet: string;
  numero: string;
  adresse?: string;
  observation?: string;
}

export interface DepotClientRequest {
  nom: string;
  prenom?: string;
  numero: string;
  adresse?: string;
  observation?: string;
}

export interface RetraitDepot {
  id: number;
  montant: number;
  dateRetrait: string;
  observation?: string;
}

export interface DepotGarde {
  id: number;
  depotClientId?: number;
  nom: string;
  prenom?: string;
  nomComplet: string;
  numero: string;
  montantInitial: number;
  montantRestant: number;
  montantRetire: number;
  statut: StatutDepot;
  dateDepot: string;
  observation?: string;
  retraits: RetraitDepot[];
}

export interface DepotGardeRequest {
  depotClientId?: number;
  nom?: string;
  prenom?: string;
  numero?: string;
  montant: number;
  observation?: string;
}

export interface RetraitDepotRequest {
  montant: number;
  observation?: string;
}

export interface StatsDepotGarde {
  totalDepots: number;
  totalActifs: number;
  totalClotures: number;
  totalMontantGarde: number;
  totalMontantInitial: number;
}

export interface ClientDepotGroupe {
  numero: string;
  nom: string;
  prenom?: string;
  nomComplet: string;
  nombreDepotsActifs: number;
  totalMontantInitial: number;
  totalMontantRestant: number;
  totalMontantRetire: number;
  depots: DepotGarde[];
}

export interface RetraitGlobalRequest {
  numero: string;
  montant?: number;
  observation?: string;
}

@Injectable({ providedIn: 'root' })
export class DepotGardeService {
  private readonly url = `${environment.apiUrl}/depots-garde`;
  private readonly clientUrl = `${environment.apiUrl}/depot-clients`;

  constructor(private http: HttpClient) {}

  // ---- Clients dépôt ----
  getTousClients(): Observable<DepotClient[]> {
    return this.http.get<DepotClient[]>(this.clientUrl);
  }

  rechercherClients(q: string): Observable<DepotClient[]> {
    const params = new HttpParams().set('q', q);
    return this.http.get<DepotClient[]>(`${this.clientUrl}/search`, { params });
  }

  creerClient(request: DepotClientRequest): Observable<DepotClient> {
    return this.http.post<DepotClient>(this.clientUrl, request);
  }

  modifierClient(id: number, request: DepotClientRequest): Observable<DepotClient> {
    return this.http.put<DepotClient>(`${this.clientUrl}/${id}`, request);
  }

  supprimerClient(id: number): Observable<void> {
    return this.http.delete<void>(`${this.clientUrl}/${id}`);
  }

  creer(request: DepotGardeRequest): Observable<DepotGarde> {
    return this.http.post<DepotGarde>(this.url, request);
  }

  modifier(id: number, request: DepotGardeRequest): Observable<DepotGarde> {
    return this.http.put<DepotGarde>(`${this.url}/${id}`, request);
  }

  getById(id: number): Observable<DepotGarde> {
    return this.http.get<DepotGarde>(`${this.url}/${id}`);
  }

  getTous(): Observable<DepotGarde[]> {
    return this.http.get<DepotGarde[]>(this.url);
  }

  getActifs(): Observable<DepotGarde[]> {
    return this.http.get<DepotGarde[]>(`${this.url}/actifs`);
  }

  rechercher(q: string): Observable<DepotGarde[]> {
    const params = new HttpParams().set('q', q);
    return this.http.get<DepotGarde[]>(`${this.url}/rechercher`, { params });
  }

  effectuerRetrait(id: number, request: RetraitDepotRequest): Observable<DepotGarde> {
    return this.http.post<DepotGarde>(`${this.url}/${id}/retrait`, request);
  }

  cloturer(id: number): Observable<DepotGarde> {
    return this.http.patch<DepotGarde>(`${this.url}/${id}/cloturer`, {});
  }

  getStatistiques(): Observable<StatsDepotGarde> {
    return this.http.get<StatsDepotGarde>(`${this.url}/statistiques`);
  }

  getGroupesClient(): Observable<ClientDepotGroupe[]> {
    return this.http.get<ClientDepotGroupe[]>(`${this.url}/groupes-client`);
  }

  retraitGlobal(request: RetraitGlobalRequest): Observable<DepotGarde[]> {
    return this.http.post<DepotGarde[]>(`${this.url}/retrait-global`, request);
  }

  formatMontant(m: number): string {
    return new Intl.NumberFormat('fr-FR').format(m) + ' FCFA';
  }
}
