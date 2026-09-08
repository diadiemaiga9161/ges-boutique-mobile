import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

// Programme de fidélité — voir CleFonctionnalite.PROGRAMME_FIDELITE côté backend
// (masquage géré par BoutiqueService.fonctionnalitesAvancees$, système déjà en place,
// réutilisé tel quel — voir app.component.ts).

export interface ParametresFidelite {
  /** FCFA dépensés par le client pour gagner 1 point. */
  montantParPoint: number;
  /** Valeur en FCFA d'1 point utilisé. */
  pointValeur: number;
}

export interface SoldeFidelite {
  points: number;
  valeurFcfa: number;
}

export type TypeMouvementFidelite = 'GAGNE' | 'UTILISE' | 'AJUSTEMENT';

export interface MouvementFidelite {
  id?: number;
  type: TypeMouvementFidelite;
  points: number;
  date: string;
  venteId?: number;
  motif?: string;
}

export interface UtiliserPointsFideliteResponse {
  success: boolean;
  message?: string;
  solde?: SoldeFidelite;
}

@Injectable({ providedIn: 'root' })
export class FideliteService {
  private readonly url = `${environment.apiUrl}/fidelite`;

  constructor(private http: HttpClient) {}

  getParametres(): Observable<ParametresFidelite> {
    return this.http.get<any>(`${this.url}/parametres`).pipe(
      map(response => ({
        montantParPoint: Number(response?.montantParPoint ?? 0),
        pointValeur: Number(response?.pointValeur ?? 0)
      }))
    );
  }

  modifierParametres(parametres: ParametresFidelite): Observable<ParametresFidelite> {
    return this.http.put<any>(`${this.url}/parametres`, parametres).pipe(
      map(response => ({
        montantParPoint: Number(response?.montantParPoint ?? parametres.montantParPoint),
        pointValeur: Number(response?.pointValeur ?? parametres.pointValeur)
      }))
    );
  }

  getSoldeClient(clientId: number): Observable<SoldeFidelite> {
    return this.http.get<any>(`${this.url}/clients/${clientId}`).pipe(
      map(response => ({
        points: Number(response?.points ?? 0),
        valeurFcfa: Number(response?.valeurFcfa ?? 0)
      }))
    );
  }

  getMouvementsClient(clientId: number): Observable<MouvementFidelite[]> {
    return this.http.get<any>(`${this.url}/clients/${clientId}/mouvements`).pipe(
      map(response => {
        const liste = Array.isArray(response) ? response
          : (response?.mouvements || response?.data || response?.content || []);
        return Array.isArray(liste) ? liste : [];
      })
    );
  }

  utiliserPoints(clientId: number, points: number, venteId: number): Observable<UtiliserPointsFideliteResponse> {
    return this.http.post<UtiliserPointsFideliteResponse>(`${this.url}/clients/${clientId}/utiliser`, { points, venteId });
  }

  ajusterSolde(clientId: number, delta: number, motif: string): Observable<SoldeFidelite> {
    return this.http.patch<any>(`${this.url}/clients/${clientId}/ajuster`, { delta, motif }).pipe(
      map(response => ({
        points: Number(response?.points ?? response?.solde?.points ?? 0),
        valeurFcfa: Number(response?.valeurFcfa ?? response?.solde?.valeurFcfa ?? 0)
      }))
    );
  }

  formatMontant(valeur: number): string {
    const n = Math.round(valeur || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
  }
}
