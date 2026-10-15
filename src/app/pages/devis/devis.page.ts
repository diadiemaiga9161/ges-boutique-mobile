import { Component, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController, ToastController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { BoutiqueService } from '../../services/boutique.service';

interface LigneDevis {
  designation: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

interface Devis {
  id: number;
  numero: string;
  clientNom: string;
  clientTelephone: string | null;
  objet: string | null;
  dateCreation: string;
  dateValidite: string;
  statut: 'EN_ATTENTE' | 'TRANSFORME' | 'REFUSE' | 'EXPIRE';
  montantTotal: number;
  remise: number;
  lignes: LigneDevis[];
}

interface Transformation {
  devis: Devis;
  comptant: boolean;
  modePaiement: string;
  dateEcheance: string;
  montantVerse: number | null;
}

const STATUTS: Record<string, string> = {
  EN_ATTENTE: 'En attente',
  TRANSFORME: 'Devenu vente',
  REFUSE: 'Refusé',
  EXPIRE: 'Expiré'
};

/** Devis (pro forma) : voir, envoyer, et transformer en vente quand le client accepte. */
@Component({
  selector: 'app-devis',
  templateUrl: './devis.page.html',
  styleUrls: ['./devis.page.scss'],
  standalone: false
})
export class DevisPage {
  private readonly api = `${environment.apiUrl}/devis`;
  devis: Devis[] = [];
  chargement = false;
  erreur = '';
  ouvert: number | null = null;
  transformation: Transformation | null = null;
  envoi = false;
  readonly modes = [
    { cle: 'ESPECES', libelle: 'Espèces' },
    { cle: 'ORANGE_MONEY', libelle: 'Orange Money' },
    { cle: 'MOOV_MONEY', libelle: 'Moov Money' },
    { cle: 'WAVE_MONEY', libelle: 'Wave' }
  ];

  constructor(private http: HttpClient, private boutiqueService: BoutiqueService,
              private alertCtrl: AlertController, private toastCtrl: ToastController) {}

  ionViewWillEnter(): void {
    this.charger();
  }

  @HostListener('document:keydown.escape')
  surEchap(): void {
    this.transformation = null;
  }

  charger(event?: any): void {
    this.chargement = true;
    this.erreur = '';
    this.http.get<Devis[]>(this.api).subscribe({
      next: d => { this.devis = d; this.chargement = false; event?.target?.complete(); },
      error: e => {
        this.erreur = e?.error?.message || 'Impossible de charger les devis.';
        this.chargement = false;
        event?.target?.complete();
      }
    });
  }

  get enAttente(): number {
    return this.devis.filter(d => d.statut === 'EN_ATTENTE').length;
  }

  get montantEnAttente(): number {
    return this.devis.filter(d => d.statut === 'EN_ATTENTE').reduce((s, d) => s + d.montantTotal, 0);
  }

  statut(d: Devis): string {
    return STATUTS[d.statut] || d.statut;
  }

  basculer(d: Devis): void {
    this.ouvert = this.ouvert === d.id ? null : d.id;
  }

  // ------------------------------------------------------------------ actions

  whatsapp(d: Devis): void {
    const n = (d.clientTelephone || '').replace(/\D/g, '');
    const boutique = this.boutiqueService.getInfo()?.nom || '';
    const lignes = d.lignes.map(l => `• ${l.quantite} × ${l.designation} : ${this.prix(l.sousTotal)}`).join('\n');
    const message = `Bonjour,\nVoici notre devis ${d.numero}${d.objet ? ' (' + d.objet + ')' : ''} :\n${lignes}\n`
      + (d.remise > 0 ? `Remise : − ${this.prix(d.remise)}\n` : '')
      + `TOTAL : ${this.prix(d.montantTotal)}\nValable jusqu'au ${this.date(d.dateValidite)}.\n${boutique}`;
    const url = n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  }

  ouvrirTransformation(d: Devis): void {
    const dans30 = new Date();
    dans30.setDate(dans30.getDate() + 30);
    this.transformation = { devis: d, comptant: false, modePaiement: 'ESPECES', dateEcheance: this.iso(dans30), montantVerse: null };
  }

  transformer(): void {
    const t = this.transformation;
    if (!t) return;
    this.envoi = true;
    this.http.post<any>(`${this.api}/${t.devis.id}/transformer`, {
      comptant: t.comptant, modePaiement: t.modePaiement, dateEcheance: t.dateEcheance, montantVerse: t.montantVerse || 0
    }).subscribe({
      next: r => {
        this.envoi = false;
        this.transformation = null;
        this.toast(`Devenu la vente ${r.numeroVente || ''} (${this.prix(r.montantVente)})`, 'success');
        this.charger();
      },
      error: e => { this.envoi = false; this.toast(e?.error?.message || 'Transformation impossible.', 'danger'); }
    });
  }

  async refuser(d: Devis): Promise<void> {
    const a = await this.alertCtrl.create({
      header: 'Devis refusé ?',
      message: `Le client a refusé le devis ${d.numero} ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Oui, refusé', handler: () => this.action(`${this.api}/${d.id}/refuser`, {}, 'Devis marqué refusé') }
      ]
    });
    await a.present();
  }

  prolonger(d: Devis): void {
    this.action(`${this.api}/${d.id}/prolonger`, { jours: 30 }, 'Devis prolongé de 30 jours');
  }

  private action(url: string, corps: object, ok: string): void {
    this.http.post(url, corps).subscribe({
      next: () => { this.toast(ok, 'success'); this.charger(); },
      error: e => this.toast(e?.error?.message || 'Action impossible.', 'danger')
    });
  }

  // ------------------------------------------------------------------ outils

  prix(v: number): string {
    return Math.round(v || 0).toLocaleString('fr-FR') + ' F';
  }

  date(iso: string): string {
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2600, position: 'top' });
    await t.present();
  }
}
