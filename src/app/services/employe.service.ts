import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type StatutEmploye = 'ACTIF' | 'INACTIF';

export interface Employe {
  id: number;
  nom: string;
  prenom?: string;
  nomComplet: string;
  poste: string;
  salaireMensuel: number;
  telephone?: string;
  observation?: string;
  statut: StatutEmploye;
  dateEmbauche?: string;
  dateCreation: string;
}

export interface EmployeRequest {
  nom: string;
  prenom?: string;
  poste: string;
  salaireMensuel: number;
  telephone?: string;
  observation?: string;
  statut?: StatutEmploye;
  dateEmbauche?: string;
}

@Injectable({ providedIn: 'root' })
export class EmployeService {
  private readonly url = `${environment.apiUrl}/employes`;

  constructor(private http: HttpClient) {}

  creer(request: EmployeRequest): Observable<Employe> {
    return this.http.post<Employe>(this.url, request);
  }

  modifier(id: number, request: EmployeRequest): Observable<Employe> {
    return this.http.put<Employe>(`${this.url}/${id}`, request);
  }

  getById(id: number): Observable<Employe> {
    return this.http.get<Employe>(`${this.url}/${id}`);
  }

  getTous(): Observable<Employe[]> {
    return this.http.get<Employe[]>(this.url);
  }

  getActifs(): Observable<Employe[]> {
    return this.http.get<Employe[]>(`${this.url}/actifs`);
  }

  desactiver(id: number): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/desactiver`, {});
  }

  activer(id: number): Observable<void> {
    return this.http.patch<void>(`${this.url}/${id}/activer`, {});
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }
}
