import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RecommandationIA {
  id: string;
  type: string;
  priorite: string;
  titre: string;
  description: string;
  actionLabel: string;
  donnees: any;
  scoreConfiance: number;
}

export interface AlerteIA {
  message?: string;
  niveau?: string;
  titre?: string;
}

export interface AnalyseIAResult {
  scoreGlobal: number;
  tendanceCA: string;
  tauxCroissanceMensuel: number;
  previsionCA7Jours: number;
  previsionCA30Jours: number;
  caHier: number;
  caCetteSemaine: number;
  caCeMois: number;
  recommandations: RecommandationIA[];
  alertes: AlerteIA[];
  segmentsClients: { [key: string]: number };
  previsionCA30JoursDetail: { date: string; prevision: number }[];
  precisionModele: number;
}

export interface ProfilIA {
  typeBoutique: string;
  joursApprovisionnement: string[];
  objectifStockJours: number;
  margeCiblePourcent: number;
  delaiRelanceCreditJours: number;
}

@Injectable({ providedIn: 'root' })
export class IAService {
  private readonly base = `${environment.apiUrl}/ia`;

  constructor(private http: HttpClient) {}

  getProfil(): Observable<ProfilIA> {
    return this.http.get<ProfilIA>(`${this.base}/profil`);
  }

  sauvegarderProfil(profil: ProfilIA): Observable<any> {
    return this.http.post<any>(`${this.base}/profil`, profil);
  }

  analyser(): Observable<AnalyseIAResult> {
    return this.http.get<AnalyseIAResult>(`${this.base}/analyse`);
  }

  getRecommandations(): Observable<RecommandationIA[]> {
    return this.http.get<RecommandationIA[]>(`${this.base}/recommandations`);
  }

  enregistrerFeedback(id: string, statut: 'SUIVIE' | 'IGNOREE'): Observable<any> {
    return this.http.post<any>(`${this.base}/feedback/${id}`, { statut });
  }

  getScoreSante(): Observable<any> {
    return this.http.get<any>(`${this.base}/sante`);
  }
}
