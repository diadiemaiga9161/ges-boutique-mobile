import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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
  waveMoney: number;
  total: number;
  nombreOrange: number;
  nombreMoov: number;
  nombreWave: number;
  nombreTotal: number;
}

@Component({
  selector: 'app-mobile-money',
  templateUrl: './mobile-money.page.html',
  styleUrls: ['./mobile-money.page.scss'],
  standalone: false
})
export class MobileMoneyPage implements OnInit {
  trackById = (_: number, item: any) => item.id;

  type = 'TOUS';
  periode = 'JOUR';
  operations: OperationMM[] = [];
  totalOrange = 0;
  totalMoov = 0;
  totalWave = 0;
  totalGlobal = 0;
  nombreOperations = 0;
  resume: Record<string, ResumeMM> | null = null;
  loading = false;
  activeTab: 'operations' | 'resume' | 'telecharger' = 'operations';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private toastCtrl: ToastController
  ) {}

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
          this.totalWave = data.totalWaveMoney || 0;
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

  onTypeChange(t: string) { this.type = t; this.chargerDonnees(); }
  onPeriodeChange(p: string) { this.periode = p; this.chargerDonnees(); }

  // Téléchargement CSV par opérateur ou tous
  /** Le serveur exige le jeton sur cette adresse : on demande le fichier avec HttpClient
   *  (comme les autres appels de la page) puis on l'enregistre. Avant, un lien direct
   *  partait sans jeton et le téléchargement échouait. */
  exportCsv(operateur?: string) {
    const type = operateur || this.type;
    const nom = operateur ? operateur.toLowerCase().replace('_money', '') : 'tous';
    const nomFichier = `mobile-money-${nom}-${this.periode.toLowerCase()}.csv`;
    this.presentToast(`Téléchargement ${this.operateurLabel(type)} en cours...`);
    this.http.get(`/api/mobile-money/export/csv?type=${type}&periode=${this.periode}`,
      { headers: this.headers(), responseType: 'blob' })
      .subscribe({
        next: (blob) => this.enregistrerFichier(blob, nomFichier),
        error: () => this.presentToast('Téléchargement impossible.', 'danger'),
      });
  }

  /** Enregistre le fichier reçu : partage du fichier sur téléphone, téléchargement
   *  du navigateur sur web (≡ backup.service.telechargerEtPartager). */
  private async enregistrerFichier(blob: Blob, nomFichier: string): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const base64 = await this.blobToBase64(blob);
        const resultat = await Filesystem.writeFile({ path: nomFichier, data: base64, directory: Directory.Cache });
        await Share.share({ title: nomFichier, url: resultat.uri, dialogTitle: nomFichier });
      } else {
        const url = window.URL.createObjectURL(blob);
        const lien = document.createElement('a');
        lien.href = url;
        lien.download = nomFichier;
        document.body.appendChild(lien);
        lien.click();
        document.body.removeChild(lien);
        window.URL.revokeObjectURL(url);
      }
    } catch {
      this.presentToast('Enregistrement du fichier impossible.', 'danger');
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(((reader.result as string) || '').split(',')[1] || '');
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  operateurLabel(type: string): string {
    const labels: Record<string, string> = {
      ORANGE_MONEY: 'Orange Money', MOOV_MONEY: 'Moov Money',
      WAVE_MONEY: 'Wave', TOUS: 'Tous'
    };
    return labels[type] || type;
  }

  formatMontant(m: number): string {
    const n = Math.round(m || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} F`;
  }

  periodeLabel(): string {
    const labels: any = { JOUR: "Aujourd'hui", SEMAINE: 'Cette semaine', MOIS: 'Ce mois', ANNEE: "Cette année" };
    return labels[this.periode] || this.periode;
  }

  modeIcon(mode: string): string {
    if (mode === 'ORANGE_MONEY') return '🟠';
    if (mode === 'MOOV_MONEY') return '🔵';
    if (mode === 'WAVE_MONEY') return '🌊';
    return '💰';
  }

  modeColor(mode: string): string {
    if (mode === 'ORANGE_MONEY') return 'warning';
    if (mode === 'MOOV_MONEY') return 'primary';
    if (mode === 'WAVE_MONEY') return 'tertiary';
    return 'medium';
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({ message, duration: 2000, position: 'bottom', color });
    await toast.present();
  }
}
