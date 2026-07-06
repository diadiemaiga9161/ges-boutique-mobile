import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { FactureService } from './facture.service';

export interface BeneficeLigne {
  label: string;
  benefice: number;
  nombreVentes: number;
}

export interface BeneficeData {
  periode: 'JOURNALIER' | 'HEBDOMADAIRE' | 'MENSUEL' | 'ANNUEL';
  dateDebut: string;
  dateFin: string;
  beneficeTotal: number;
  chiffreAffaireTotal: number;
  nombreVentes: number;
  margeMoyenne: number;
  evolution: number;
  lignes: BeneficeLigne[];
}

@Injectable({ providedIn: 'root' })
export class BeneficeService {

  private base = `${environment.apiUrl}/benefices`;

  constructor(
    private http: HttpClient,
    private factureService: FactureService
  ) {}

  journalier(date?: string): Observable<BeneficeData> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<BeneficeData>(`${this.base}/journalier`, { params })
      .pipe(catchError(e => throwError(() => new Error(e.error?.message || 'Erreur chargement bénéfices'))));
  }

  hebdomadaire(): Observable<BeneficeData> {
    return this.http.get<BeneficeData>(`${this.base}/hebdomadaire`)
      .pipe(catchError(e => throwError(() => new Error(e.error?.message || 'Erreur chargement bénéfices'))));
  }

  mensuel(mois?: number, annee?: number): Observable<BeneficeData> {
    let params = new HttpParams();
    if (mois)  params = params.set('mois', mois);
    if (annee) params = params.set('annee', annee);
    return this.http.get<BeneficeData>(`${this.base}/mensuel`, { params })
      .pipe(catchError(e => throwError(() => new Error(e.error?.message || 'Erreur chargement bénéfices'))));
  }

  annuel(annee?: number): Observable<BeneficeData> {
    let params = new HttpParams();
    if (annee) params = params.set('annee', annee);
    return this.http.get<BeneficeData>(`${this.base}/annuel`, { params })
      .pipe(catchError(e => throwError(() => new Error(e.error?.message || 'Erreur chargement bénéfices'))));
  }

  formaterPrix(v: number): string {
    return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) + ' FCFA';
  }

  exporterPDF(data: BeneficeData): void {
    const lignes = data.lignes.map(l => [
      l.label,
      this.formaterPrix(l.benefice),
      String(l.nombreVentes)
    ]);

    this.factureService.ouvrirDocumentPDF({
      titre: `Bénéfices — ${data.periode}`,
      sousTitre: `Du ${data.dateDebut} au ${data.dateFin} · Marge : ${data.margeMoyenne.toFixed(1)}% · Évolution : ${data.evolution >= 0 ? '+' : ''}${data.evolution.toFixed(1)}%`,
      colonnes: ['Période', 'Bénéfice', 'Ventes'],
      lignes,
      totaux: [
        `Bénéfice total : ${this.formaterPrix(data.beneficeTotal)}`,
        `CA total : ${this.formaterPrix(data.chiffreAffaireTotal)}`,
        `Nombre de ventes : ${data.nombreVentes}`
      ]
    });
  }
}
