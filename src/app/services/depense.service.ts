import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Depense {
  id?: number;
  nom: string;
  motif?: string;
  date: string;
  montant: number;
  operationCaisseId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepenseRequest {
  nom: string;
  motif?: string;
  date: string;
  montant: number;
}

@Injectable({ providedIn: 'root' })
export class DepenseService {

  private readonly apiUrl = `${environment.apiUrl}/depenses`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ depenses: Depense[]; total: number }> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(r => ({ depenses: r.depenses || [], total: r.total || 0 })),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur chargement dépenses')))
    );
  }

  getParPeriode(debut: string, fin: string): Observable<{ depenses: Depense[]; total: number }> {
    return this.http.get<any>(`${this.apiUrl}/periode`, { params: { debut, fin } }).pipe(
      map(r => ({ depenses: r.depenses || [], total: r.total || 0 })),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur filtre période')))
    );
  }

  creer(request: DepenseRequest): Observable<Depense> {
    return this.http.post<any>(this.apiUrl, request).pipe(
      map(r => r.depense || r),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur création dépense')))
    );
  }

  modifier(id: number, request: DepenseRequest): Observable<Depense> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request).pipe(
      map(r => r.depense || r),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur modification dépense')))
    );
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => void 0),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur suppression dépense')))
    );
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
  }
}
