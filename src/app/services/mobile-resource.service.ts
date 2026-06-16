import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ResourceConfig {
  type: string;
  title: string;
  endpoint: string;
  responseKey?: string;
  searchParam?: string;
  fields: string[];
  amountField?: string;
  dateField?: string;
}

export const RESOURCE_CONFIGS: ResourceConfig[] = [
  {
    type: 'factures',
    title: 'Factures',
    endpoint: '/caisse/factures',
    responseKey: 'factures',
    searchParam: 'clientNom',
    fields: ['numeroFacture', 'clientNom', 'statut'],
    amountField: 'montantTotal',
    dateField: 'dateCreation'
  },
  {
    type: 'comptes',
    title: 'Comptes',
    endpoint: '/comptes',
    fields: ['nom', 'numeroCompte', 'banque'],
    amountField: 'solde',
    dateField: 'dateCreation'
  },
  {
    type: 'dettes',
    title: 'Dettes anciennes',
    endpoint: '/dettes-anciennes',
    responseKey: 'dettes',
    searchParam: 'query',
    fields: ['clientNom', 'clientTelephone', 'statut'],
    amountField: 'montantRestant',
    dateField: 'dateDette'
  },
  {
    type: 'employes',
    title: 'Employés',
    endpoint: '/employes',
    fields: ['nom', 'prenom', 'telephone', 'poste'],
    amountField: 'salaireMensuel',
    dateField: 'dateEmbauche'
  },
  {
    type: 'paiement-employe',
    title: 'Paiements employés',
    endpoint: '/paiements-employe',
    fields: ['employeNomComplet', 'nombreMois', 'statut'],
    amountField: 'montant',
    dateField: 'datePaiement'
  },
  {
    type: 'fournisseurs',
    title: 'Fournisseurs',
    endpoint: '/produits/fournisseurs',
    responseKey: 'data',
    searchParam: 'motCle',
    fields: ['nom', 'telephone', 'email'],
    amountField: 'solde',
    dateField: 'dateAjout'
  },
  {
    type: 'vendeurs',
    title: 'Vendeurs',
    endpoint: '/utilisateurs',
    responseKey: 'users',
    searchParam: 'query',
    fields: ['nomComplet', 'username', 'role'],
    dateField: 'dateCreation'
  },
  {
    type: 'depots-garde',
    title: 'Dépôts Garde',
    endpoint: '/depots-garde',
    searchParam: 'q',
    fields: ['nomComplet', 'numero', 'statut'],
    amountField: 'montantRestant',
    dateField: 'dateDepot'
  },
  {
    type: 'objectifs-fournisseur',
    title: 'Objectifs Fournisseurs',
    endpoint: '/objectifs-fournisseur',
    fields: ['fournisseurNom', 'statut'],
    amountField: 'bonusCalcule',
    dateField: 'dateCreation'
  }
];

@Injectable({
  providedIn: 'root'
})
export class MobileResourceService {
  constructor(private http: HttpClient) {}

  getConfig(type: string | null): ResourceConfig | undefined {
    return RESOURCE_CONFIGS.find(config => config.type === type);
  }

  list(config: ResourceConfig, query = ''): Observable<any[]> {
    const url = `${environment.apiUrl}${config.endpoint}`;
    const params = query && config.searchParam ? new HttpParams().set(config.searchParam, query) : undefined;

    return this.http.get<any>(url, { params }).pipe(
      map(response => this.extractList(response, config.responseKey))
    );
  }

  private extractList(response: any, key?: string): any[] {
    if (Array.isArray(response)) return response;
    if (key && Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.items)) return response.items;
    if (Array.isArray(response?.content)) return response.content;
    return [];
  }
}
