import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export enum StatutCommande {
  BROUILLON = 'BROUILLON',
  VALIDEE = 'VALIDEE'
}

export interface LigneCommande {
  id?: number;
  produitId?: number;
  produitNom?: string;
  produit?: { id: number; nom: string; prixVente: number };
  quantite: number;
  prixUnitaire: number;
  sousTotal?: number;
}

export interface Commande {
  id: number;
  numeroCommande: string;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  client?: { id: number; nom: string; prenom: string; numeroTelephone: string };
  lignes: LigneCommande[];
  montantTotal: number;
  modePaiement: string;
  referencePaiement?: string;
  estCredit: boolean;
  montantVerse: number;
  montantRestant: number;
  dateEcheance?: string;
  statut: StatutCommande;
  dateCommande: string;
  dateValidation?: string;
  venteId?: number;
  notes?: string;
  vendeur?: { id: number; nomComplet: string };
}

export interface CommandeRequest {
  vendeurId: number;
  clientId?: number;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  lignes: { produitId: number; quantite: number; prixUnitaire: number }[];
  modePaiement: string;
  referencePaiement?: string;
  estCredit?: boolean;
  montantVerse?: number;
  dateEcheance?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class CommandeService {
  private readonly apiUrl = `${environment.apiUrl}/commandes`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAll(): Observable<Commande[]> {
    return this.http.get<Commande[]>(this.apiUrl);
  }

  getById(id: number): Observable<Commande> {
    return this.http.get<Commande>(`${this.apiUrl}/${id}`);
  }

  creer(request: CommandeRequest): Observable<any> {
    return this.http.post<any>(this.apiUrl, request);
  }

  modifier(id: number, request: CommandeRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request);
  }

  valider(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/valider`, {});
  }

  supprimer(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  formatMontant(v: number): string {
    return new Intl.NumberFormat('fr-FR').format(v || 0) + ' FCFA';
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getClientNom(c: Commande): string {
    return [c.clientNom, c.clientPrenom].filter(Boolean).join(' ') || c.client?.nom || 'N/A';
  }
}
