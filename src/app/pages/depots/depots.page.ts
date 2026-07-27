import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import {
  DepotGarde,
  DepotGardeService,
  DepotGardeRequest,
  DepotClient,
  RetraitDepotRequest,
  StatsDepotGarde,
  ClientDepotGroupe,
  RetraitGlobalRequest
} from '../../services/depot-garde.service';

@Component({
  selector: 'app-depots',
  templateUrl: './depots.page.html',
  styleUrls: ['./depots.page.scss'],
  standalone: false
})
export class DepotsPage {
  trackById = (_: number, item: any) => item.id;

  depots: DepotGarde[] = [];
  filteredDepots: DepotGarde[] = [];
  stats?: StatsDepotGarde;
  loading = false;
  searchTerm = '';
  filterStatut: 'TOUS' | 'ACTIF' | 'CLOTURE' = 'TOUS';

  vueMode: 'liste' | 'groupes' = 'liste';
  groupesClient: ClientDepotGroupe[] = [];
  loadingGroupes = false;

  // Formulaire création/édition
  showDepotModal = false;
  depotForm: DepotGardeRequest & { id: number } = { id: 0, nom: '', prenom: '', numero: '', montant: 0, observation: '' };

  // Sélection personne existante
  depotClients: DepotClient[] = [];
  depotClientSearch = '';
  filteredDepotClients: DepotClient[] = [];
  selectedDepotClient: DepotClient | null = null;

  // Détail
  showDetailModal = false;
  selectedDepot?: DepotGarde;

  // Retrait
  showRetraitModal = false;
  retraitDepot?: DepotGarde;
  retraitForm: RetraitDepotRequest = { montant: 0, observation: '' };

  // Retrait global
  showRetraitGlobalModal = false;
  clientRetraitGlobal?: ClientDepotGroupe;
  retraitGlobalForm: RetraitGlobalRequest = { numero: '', montant: 0, observation: '' };

  constructor(
    private depotService: DepotGardeService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.load();
    this.loadStats();
    this.depotService.getTousClients().subscribe({ next: c => this.depotClients = c, error: () => {} });
  }

  load(event?: any): void {
    this.loading = true;
    const obs = this.searchTerm.trim()
      ? this.depotService.rechercher(this.searchTerm)
      : this.depotService.getTous();
    obs.subscribe({
      next: list => {
        this.depots = list;
        this.applyFilter();
        this.loading = false;
        event?.target?.complete();
      },
      error: err => {
        this.loading = false;
        event?.target?.complete();
        this.toast(err?.error?.message || 'Chargement impossible', 'danger');
      }
    });
  }

  loadStats(): void {
    this.depotService.getStatistiques().subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  applyFilter(): void {
    if (this.filterStatut === 'TOUS') {
      this.filteredDepots = this.depots;
    } else {
      this.filteredDepots = this.depots.filter(d => d.statut === this.filterStatut);
    }
  }

  onSearch(): void {
    this.load();
  }

  setFilter(f: 'TOUS' | 'ACTIF' | 'CLOTURE'): void {
    this.filterStatut = f;
    this.applyFilter();
  }

  // ======= Création / Édition =======

  openNew(): void {
    this.depotForm = { id: 0, nom: '', prenom: '', numero: '', montant: 0, observation: '' };
    this.selectedDepotClient = null;
    this.depotClientSearch = '';
    this.filteredDepotClients = [];
    this.showDepotModal = true;
  }

  searchDepotClients(): void {
    const q = this.depotClientSearch.trim().toLowerCase();
    this.filteredDepotClients = q
      ? this.depotClients.filter(c => c.nomComplet.toLowerCase().includes(q) || c.numero.includes(q))
      : [];
  }

  selectDepotClient(client: DepotClient): void {
    this.selectedDepotClient = client;
    this.depotForm.depotClientId = client.id;
    this.depotForm.nom = client.nom;
    this.depotForm.prenom = client.prenom || '';
    this.depotForm.numero = client.numero;
    this.depotClientSearch = client.nomComplet;
    this.filteredDepotClients = [];
  }

  clearDepotClient(): void {
    this.selectedDepotClient = null;
    this.depotForm.depotClientId = undefined;
    this.depotForm.nom = '';
    this.depotForm.prenom = '';
    this.depotForm.numero = '';
    this.depotClientSearch = '';
  }

  editDepot(depot: DepotGarde): void {
    this.depotForm = { id: depot.id, nom: depot.nom, prenom: depot.prenom || '', numero: depot.numero, montant: depot.montantInitial, observation: depot.observation || '' };
    this.showDepotModal = true;
  }

  saveDepot(): void {
    if (!(this.depotForm.nom || '').trim()) { this.toast('Le nom est obligatoire', 'danger'); return; }
    if (!(this.depotForm.numero || '').trim()) { this.toast('Le numéro est obligatoire', 'danger'); return; }
    if (!this.depotForm.id && (!this.depotForm.montant || this.depotForm.montant <= 0)) {
      this.toast('Le montant doit être supérieur à 0', 'danger'); return;
    }

    const { id, ...payload } = this.depotForm;
    const req = id ? this.depotService.modifier(id, payload) : this.depotService.creer(payload);
    req.subscribe({
      next: () => {
        this.toast(id ? 'Dépôt modifié ✓' : 'Dépôt créé ✓');
        this.showDepotModal = false;
        this.load();
        this.loadStats();
      },
      error: err => this.toast(err?.error?.message || 'Enregistrement impossible', 'danger')
    });
  }

  // ======= Détail =======

  openDetail(depot: DepotGarde): void {
    this.depotService.getById(depot.id).subscribe({
      next: d => { this.selectedDepot = d; this.showDetailModal = true; },
      error: err => this.toast(err?.error?.message || 'Chargement impossible', 'danger')
    });
  }

  // ======= Retrait =======

  openRetrait(depot: DepotGarde): void {
    this.retraitDepot = depot;
    this.retraitForm = { montant: 0, observation: '' };
    this.showRetraitModal = true;
  }

  saveRetrait(): void {
    if (!this.retraitDepot) return;
    if (!this.retraitForm.montant || this.retraitForm.montant <= 0) {
      this.toast('Le montant doit être supérieur à 0', 'danger'); return;
    }
    if (this.retraitForm.montant > this.retraitDepot.montantRestant) {
      this.toast(`Montant max: ${this.money(this.retraitDepot.montantRestant)}`, 'danger'); return;
    }

    this.depotService.effectuerRetrait(this.retraitDepot.id, this.retraitForm).subscribe({
      next: () => {
        this.toast('Retrait enregistré ✓');
        this.showRetraitModal = false;
        this.load();
        this.loadStats();
      },
      error: err => this.toast(err?.error?.message || 'Retrait impossible', 'danger')
    });
  }

  // ======= Clôture =======

  async cloturerDepot(depot: DepotGarde): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Clôturer ce dépôt ?',
      message: `${depot.nomComplet} — Solde restant : <strong>${this.money(depot.montantRestant)}</strong>`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Clôturer',
          cssClass: 'alert-btn-danger',
          handler: () => {
            this.depotService.cloturer(depot.id).subscribe({
              next: () => { this.toast('Dépôt clôturé'); this.load(); this.loadStats(); },
              error: err => this.toast(err?.error?.message || 'Clôture impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ======= Vue groupée par client =======

  basculerVue(mode: 'liste' | 'groupes'): void {
    this.vueMode = mode;
    if (mode === 'groupes' && this.groupesClient.length === 0) {
      this.chargerGroupes();
    }
  }

  chargerGroupes(): void {
    this.loadingGroupes = true;
    this.depotService.getGroupesClient().subscribe({
      next: g => { this.groupesClient = g; this.loadingGroupes = false; },
      error: () => { this.loadingGroupes = false; this.toast('Chargement groupes impossible', 'danger'); }
    });
  }

  openRetraitGlobal(client: ClientDepotGroupe): void {
    this.clientRetraitGlobal = client;
    this.retraitGlobalForm = { numero: client.numero, montant: 0, observation: '' };
    this.showRetraitGlobalModal = true;
  }

  async saveRetraitGlobal(): Promise<void> {
    if (!this.clientRetraitGlobal) return;
    const total = this.clientRetraitGlobal.totalMontantRestant;
    const montant = this.retraitGlobalForm.montant || 0;

    if (montant > 0 && montant > total) {
      this.toast(`Montant max : ${this.money(total)}`, 'danger'); return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmer le retrait global ?',
      message: `Client : <strong>${this.clientRetraitGlobal.nomComplet}</strong><br>
                Montant : <strong>${montant > 0 ? this.money(montant) : this.money(total) + ' (total)'}</strong><br>
                ${this.clientRetraitGlobal.nombreDepotsActifs} dépôt(s) concerné(s)`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Confirmer',
          cssClass: 'alert-btn-danger',
          handler: () => {
            const payload: RetraitGlobalRequest = {
              numero: this.clientRetraitGlobal!.numero,
              montant: montant > 0 ? montant : undefined,
              observation: this.retraitGlobalForm.observation
            };
            this.depotService.retraitGlobal(payload).subscribe({
              next: () => {
                this.showRetraitGlobalModal = false;
                this.clientRetraitGlobal = undefined;
                this.groupesClient = [];
                this.load();
                this.loadStats();
                this.chargerGroupes();
                this.toast('Retrait global effectué ✓');
              },
              error: err => this.toast(err?.error?.message || 'Retrait global impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ======= Utilitaires =======

  getPourcentage(depot: DepotGarde): number {
    if (!depot.montantInitial) return 0;
    return Math.round((depot.montantRetire / depot.montantInitial) * 100);
  }

  getInitiale(nom: string): string {
    return (nom || '?')[0].toUpperCase();
  }

  money(v: number): string {
    const n = Math.round(Number(v) || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await t.present();
  }
}
