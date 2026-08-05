import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { ProductService } from '../../services/product.service';
import { CaisseService } from '../../services/caisse.service';

type PeriodeType = 'today' | 'week' | 'month' | 'year' | 'all';

@Component({
  selector: 'app-annulation-paiements',
  templateUrl: './annulation-paiements.page.html',
  styleUrls: ['./annulation-paiements.page.scss'],
  standalone: false
})
export class AnnulationPaiementsPage {

  onglet: 'fournisseur' | 'credit' = 'fournisseur';

  paiementsFournisseur: any[] = [];
  paiementsFiltres: any[] = [];

  reglements: any[] = [];
  reglementsFiltres: any[] = [];

  loading = false;
  selectedPeriod: PeriodeType = 'all';
  dateDebut = '';
  dateFin = '';
  searchTerm = '';

  trackById = (_: number, item: any) => item.id;

  constructor(
    private productService: ProductService,
    private caisseService: CaisseService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private auth: AuthService
  ) {}

  ionViewWillEnter(): void {
    this.charger();
  }

  charger(): void {
    this.loading = true;
    if (this.onglet === 'fournisseur') {
      this.chargerPaiementsFournisseur();
    } else {
      this.chargerReglements();
    }
  }

  chargerPaiementsFournisseur(): void {
    this.productService.getPaiementsParPeriode(this.dateDebut || undefined, this.dateFin || undefined).subscribe({
      next: data => {
        this.paiementsFournisseur = data;
        this.appliquerFiltres();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast('Chargement impossible', 'danger');
      }
    });
  }

  chargerReglements(): void {
    this.caisseService.getReglementsParPeriode(this.dateDebut || undefined, this.dateFin || undefined).subscribe({
      next: data => {
        this.reglements = data;
        this.appliquerFiltres();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast('Chargement impossible', 'danger');
      }
    });
  }

  appliquerFiltres(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (this.onglet === 'fournisseur') {
      this.paiementsFiltres = this.paiementsFournisseur.filter(p =>
        !term ||
        (p.fournisseur?.nom || '').toLowerCase().includes(term) ||
        (p.reference || '').toLowerCase().includes(term)
      );
    } else {
      this.reglementsFiltres = this.reglements.filter(r =>
        !term ||
        (r.clientNom || '').toLowerCase().includes(term) ||
        (r.motif || '').toLowerCase().includes(term)
      );
    }
  }

  filterByPeriod(period: PeriodeType): void {
    this.selectedPeriod = period;
    if (period === 'all') {
      this.dateDebut = '';
      this.dateFin = '';
    } else {
      const today = new Date();
      this.dateFin = today.toISOString().split('T')[0];
      if (period === 'today') {
        this.dateDebut = this.dateFin;
      } else if (period === 'week') {
        const d = new Date(today);
        const day = d.getDay();
        d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        this.dateDebut = d.toISOString().split('T')[0];
      } else if (period === 'month') {
        this.dateDebut = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      } else {
        this.dateDebut = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      }
    }
    this.charger();
  }

  async confirmerAnnulation(item: any, type: 'fournisseur' | 'credit'): Promise<void> {
    const label = type === 'fournisseur'
      ? `Annuler le paiement de ${this.formatMontant(item.montant)} a ${item.fournisseur?.nom} ?`
      : `Annuler le reglement de ${this.formatMontant(item.montant)} pour ${item.clientNom} ?`;

    const alert = await this.alertCtrl.create({
      header: 'Annuler ce paiement ?',
      message: label + "\n\nL'argent sera remis a sa source (caisse ou banque).",
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui, annuler',
          cssClass: 'alert-button-danger',
          handler: () => {
            if (type === 'fournisseur') {
              this.annulerPaiementFournisseur(item);
            } else {
              this.annulerReglement(item);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  annulerPaiementFournisseur(paiement: any): void {
    const userId = this.auth.getUserId();
    this.productService.annulerPaiementFournisseur(paiement.id, userId).subscribe({
      next: () => {
        this.charger();
        this.toast('Paiement annule', 'success');
      },
      error: err => this.toast(err?.error?.message || 'Erreur annulation', 'danger')
    });
  }

  annulerReglement(reglement: any): void {
    const userId = this.auth.getUserId();
    this.caisseService.annulerReglementCredit(reglement.id, userId).subscribe({
      next: () => {
        this.charger();
        this.toast('Reglement annule', 'success');
      },
      error: err => this.toast(err?.error?.message || 'Erreur annulation', 'danger')
    });
  }

  countAnnules(): number {
    const list = this.onglet === 'fournisseur' ? this.paiementsFiltres : this.reglementsFiltres;
    return list.filter(x => x.annule).length;
  }

  formatMontant(v: number): string {
    const n = Math.round(v || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} F`;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  private async toast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }
}
