import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TypeDepense {
  id: number;
  nom: string;
}

export interface Depense {
  id?: number;
  nom: string;
  motif?: string;
  date: string;
  montant: number;
  typeDepense?: string;
  operationCaisseId?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DepenseRequest {
  nom: string;
  motif?: string;
  date: string;
  montant: number;
  typeDepense?: string;
}

@Injectable({ providedIn: 'root' })
export class DepenseService {

  private readonly apiUrl = `${environment.apiUrl}/depenses`;
  private readonly typesUrl = `${environment.apiUrl}/types-depense`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ depenses: Depense[]; total: number }> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(r => {
        const depenses: Depense[] = r?.data?.depenses || r?.depenses || (Array.isArray(r) ? r : []);
        const total: number = r?.data?.total ?? r?.total ?? depenses.reduce((s: number, d: any) => s + (d.montant || 0), 0);
        return { depenses, total };
      }),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur chargement dépenses')))
    );
  }

  getParPeriode(debut: string, fin: string): Observable<{ depenses: Depense[]; total: number }> {
    return this.http.get<any>(`${this.apiUrl}/periode`, { params: { debut, fin } }).pipe(
      map(r => {
        const depenses: Depense[] = r?.data?.depenses || r?.depenses || (Array.isArray(r) ? r : []);
        const total: number = r?.data?.total ?? r?.total ?? depenses.reduce((s: number, d: any) => s + (d.montant || 0), 0);
        return { depenses, total };
      }),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur filtre période')))
    );
  }

  creer(request: DepenseRequest): Observable<Depense> {
    return this.http.post<any>(this.apiUrl, request).pipe(
      map(r => r.depense || r),
      catchError(e => throwError(() => Object.assign(new Error(e?.error?.message || 'Erreur création dépense'), { status: e.status })))
    );
  }

  modifier(id: number, request: DepenseRequest): Observable<Depense> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request).pipe(
      map(r => r.depense || r),
      catchError(e => throwError(() => Object.assign(new Error(e?.error?.message || 'Erreur modification dépense'), { status: e.status })))
    );
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => void 0),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur suppression dépense')))
    );
  }

  getTotauxParType(debut?: string, fin?: string): Observable<{ [type: string]: number }> {
    const params: any = {};
    if (debut) params.debut = debut;
    if (fin) params.fin = fin;
    return this.http.get<any>(`${this.apiUrl}/par-type`, { params }).pipe(
      map(r => r.totaux || {}),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur totaux par type')))
    );
  }

  getTypes(): Observable<TypeDepense[]> {
    return this.http.get<any>(this.typesUrl).pipe(
      map(r => Array.isArray(r) ? r : (r.types || [])),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur types')))
    );
  }

  creerType(nom: string): Observable<TypeDepense> {
    return this.http.post<any>(this.typesUrl, { nom }).pipe(
      map(r => r?.type || r),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur création type')))
    );
  }

  modifierType(id: number, nom: string): Observable<TypeDepense> {
    return this.http.put<any>(`${this.typesUrl}/${id}`, { nom }).pipe(
      map(r => r?.type || r),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur modification type')))
    );
  }

  supprimerType(id: number): Observable<void> {
    return this.http.delete<any>(`${this.typesUrl}/${id}`).pipe(
      map(() => void 0),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur suppression type')))
    );
  }

  formatPrice(value: number): string {
    const n = Math.round(value || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
  }
}
