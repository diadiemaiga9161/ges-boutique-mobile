import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

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

  constructor(private http: HttpClient) {}

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
    const titre = `Rapport Bénéfices — ${data.periode}`;
    const periode = `Période : ${data.dateDebut} → ${data.dateFin}`;

    const produitRows = data.lignes.map(l => `
      <tr>
        <td>${l.label}</td>
        <td style="text-align:right;color:${l.benefice >= 0 ? '#10b981' : '#ef4444'}">${this.formaterPrix(l.benefice)}</td>
        <td style="text-align:right">${l.nombreVentes}</td>
      </tr>
    `).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${titre}</title>
      <style>
        body{font-family:Arial,sans-serif;margin:24px;color:#111}
        h1{color:#10b981;margin-bottom:4px}
        .subtitle{color:#6b7280;font-size:12px;margin-bottom:20px}
        .metrics{display:flex;gap:16px;flex-wrap:wrap;margin:16px 0}
        .metric{padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;min-width:140px}
        .metric .label{font-size:11px;color:#6b7280;margin-bottom:4px}
        .metric .val{font-size:20px;font-weight:700;color:#10b981}
        .metric .val.blue{color:#3b82f6}
        .metric .val.purple{color:#8b5cf6}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        th,td{border:1px solid #e5e7eb;padding:8px 10px;font-size:12px}
        th{background:#f9fafb;font-weight:700}
        tfoot td{font-weight:700;background:#f3f4f6}
        @media print{button{display:none}}
      </style></head><body>
      <h1>Bénéfices — ${data.periode}</h1>
      <div class="subtitle">${periode} &nbsp;|&nbsp; Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
      <div class="metrics">
        <div class="metric"><div class="label">Bénéfice total</div><div class="val">${this.formaterPrix(data.beneficeTotal)}</div></div>
        <div class="metric"><div class="label">Chiffre d'affaires</div><div class="val blue">${this.formaterPrix(data.chiffreAffaireTotal)}</div></div>
        <div class="metric"><div class="label">Ventes</div><div class="val purple">${data.nombreVentes}</div></div>
        <div class="metric"><div class="label">Marge / Évolution</div><div class="val">${data.margeMoyenne.toFixed(1)} % &nbsp; ${data.evolution >= 0 ? '+' : ''}${data.evolution.toFixed(1)} %</div></div>
      </div>
      ${data.lignes.length > 0 ? `
      <table>
        <thead><tr><th>Période</th><th style="text-align:right">Bénéfice</th><th style="text-align:right">Ventes</th></tr></thead>
        <tbody>${produitRows}</tbody>
        <tfoot><tr><td>TOTAL</td><td style="text-align:right;color:#10b981">${this.formaterPrix(data.beneficeTotal)}</td><td style="text-align:right">${data.nombreVentes}</td></tr></tfoot>
      </table>` : ''}
      <br><button onclick="window.print()">Imprimer</button>
      <button style="margin-left:10px;background:#ef4444;color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer" onclick="window.close()">Fermer</button>
      <script>window.addEventListener('afterprint',function(){window.close();});<\/script>
    </body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 300);
  }
}
