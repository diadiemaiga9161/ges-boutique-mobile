import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

/** Interface utilisée en interne par l'UI (joursApprovisionnement = tableau). */
export interface ProfilIA {
  typeBoutique: string;
  joursApprovisionnement: string[];  // ex: ['LUNDI', 'MERCREDI']
  objectifStockJours: number;
  margeObjectif: number;             // attendu par le backend
  delaiReglementCredit: number;      // attendu par le backend
}

/** Format exact attendu / retourné par le backend Spring Boot. */
interface ProfilIABackend {
  typeBoutique: string;
  joursApprovisionnement: string;    // JSON-encodé: "[\"LUNDI\",\"MERCREDI\"]"
  objectifStockJours: number;
  margeObjectif: number;
  delaiReglementCredit: number;
}

@Injectable({ providedIn: 'root' })
export class IAService {
  private readonly base = `${environment.apiUrl}/ia`;

  constructor(private http: HttpClient) {}

  getProfil(): Observable<ProfilIA> {
    return this.http.get<ProfilIABackend>(`${this.base}/profil`).pipe(
      map(backend => ({
        ...backend,
        joursApprovisionnement: this.parseJours(backend.joursApprovisionnement)
      }))
    );
  }

  sauvegarderProfil(profil: ProfilIA): Observable<any> {
    const payload: ProfilIABackend = {
      typeBoutique: profil.typeBoutique,
      joursApprovisionnement: JSON.stringify(profil.joursApprovisionnement),
      objectifStockJours: profil.objectifStockJours,
      margeObjectif: profil.margeObjectif,
      delaiReglementCredit: profil.delaiReglementCredit
    };
    return this.http.post<any>(`${this.base}/profil`, payload);
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

  getPrevisions(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/previsions`);
  }

  /** Accepte un tableau ou une chaîne JSON et retourne toujours un tableau. */
  private parseJours(val: string | string[]): string[] {
    if (Array.isArray(val)) return val;
    if (!val) return [];
    try { return JSON.parse(val); } catch { return []; }
  }
}
