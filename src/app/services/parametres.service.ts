import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface StatutParametres {
  nombreOperationsCaisse: number;
  soldeCaisseActuel: number;
  nombreCreditsRegles: number;
  nombreVentesAnnulees: number;
}

export interface SelectionParametres {
  soldeCaisse?: boolean;
  historiqueOperationsCaisse?: boolean;
  creditsRegles?: boolean;
  historiqueVentesAnnulees?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ParametresService {
  private readonly apiUrl = `${environment.apiUrl}/parametres`;

  constructor(private http: HttpClient) {}

  getStatut(): Observable<StatutParametres> {
    return this.http.get<StatutParametres>(`${this.apiUrl}/statut`).pipe(
      catchError(error => this.handleError(error, 'récupérer le statut'))
    );
  }

  reinitialiser(selection: SelectionParametres): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/reinitialiser`, selection).pipe(
      catchError(error => this.handleError(error, 'réinitialiser les données'))
    );
  }

  supprimer(selection: SelectionParametres): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/supprimer`, { body: selection }).pipe(
      catchError(error => this.handleError(error, 'supprimer les données'))
    );
  }

  private handleError(error: any, context: string): Observable<never> {
    let message = `Impossible de ${context}`;
    if (error.status === 0) message = 'Impossible de se connecter au serveur';
    if (error.error?.message) message = error.error.message;
    if (typeof error.error === 'string') message = error.error;
    return throwError(() => new Error(message));
  }
}
