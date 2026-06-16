import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

interface OperationMM {
  id: number;
  numeroVente: string;
  dateVente: string;
  montantTotal: number;
  modePaiement: string;
  referencePaiement: string;
  clientNom: string;
  vendeurNom: string;
}

interface ResumeMM {
  orangeMoney: number;
  moovMoney: number;
  total: number;
  nombreOrange: number;
  nombreMoov: number;
  nombreTotal: number;
}

@Component({
  selector: 'app-mobile-money',
  templateUrl: './mobile-money.page.html',
  standalone: false
})
export class MobileMoneyPage implements OnInit {
  type = 'TOUS';
  periode = 'JOUR';
  operations: OperationMM[] = [];
  totalOrange = 0;
  totalMoov = 0;
  totalGlobal = 0;
  nombreOperations = 0;
  resume: Record<string, ResumeMM> | null = null;
  loading = false;
  activeTab: 'operations' | 'resume' = 'operations';

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.chargerDonnees();
    this.chargerResume();
  }

  private headers(): HttpHeaders {
    const token = this.auth.getToken() || '';
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  chargerDonnees() {
    this.loading = true;
    this.http.get<any>(`/api/mobile-money/operations?type=${this.type}&periode=${this.periode}`,
      { headers: this.headers() })
      .subscribe({
        next: (data) => {
          this.operations = data.operations || [];
          this.totalOrange = data.totalOrangeMoney || 0;
          this.totalMoov = data.totalMoovMoney || 0;
          this.totalGlobal = data.totalGlobal || 0;
          this.nombreOperations = data.nombreOperations || 0;
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  chargerResume() {
    this.http.get<any>('/api/mobile-money/resume', { headers: this.headers() })
      .subscribe({ next: (data) => { this.resume = data; } });
  }

  onTypeChange(t: string) {
    this.type = t;
    this.chargerDonnees();
  }

  onPeriodeChange(p: string) {
    this.periode = p;
    this.chargerDonnees();
  }

  exportCsv() {
    const url = `/api/mobile-money/export/csv?type=${this.type}&periode=${this.periode}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mobile-money-${this.periode.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  formatMontant(m: number): string {
    return new Intl.NumberFormat('fr-FR').format(m) + ' F';
  }

  periodeLabel(): string {
    const labels: any = { JOUR: "Aujourd'hui", SEMAINE: 'Cette semaine', MOIS: 'Ce mois', ANNEE: "Cette année" };
    return labels[this.periode] || this.periode;
  }

  modeIcon(mode: string): string {
    return mode === 'ORANGE_MONEY' ? '🟠' : mode === 'MOOV_MONEY' ? '🔵' : '💰';
  }
}
