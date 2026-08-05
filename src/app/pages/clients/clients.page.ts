import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { AvanceClientRequest, Client, ClientReleveLigne, ClientReleveResponse, ClientService, HistoriqueAvanceResponse } from '../../services/client.service';
import { VenteMap, VenteService } from '../../services/vente.service';
import { AuthService } from '../../services/auth.service';
import { BoutiqueConfigService } from '../../services/boutique-config.service';
import { DesignFacture, FactureDesignService } from '../../services/facture-design.service';
import { FactureService } from '../../services/facture.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { OfflineSyncService } from '../../services/offline-sync.service';

@Component({
  selector: 'app-clients',
  templateUrl: './clients.page.html',
  styleUrls: ['./clients.page.scss'],
  standalone: false
})
export class ClientsPage {
  clients: Client[] = [];
  filtered: Client[] = [];
  query = '';
  loading = false;
  trackById = (_: number, item: any) => item.id;
  showForm = false;
  editing?: Client;
  form: Client = this.emptyForm();

  // Ventes par client
  showVentesModal = false;
  selectedClientForVentes?: Client;
  ventesClient: VenteMap[] = [];
  ventesFiltered: VenteMap[] = [];
  loadingVentes = false;
  filterVenteType = '';

  // Détail vente (produits)
  showVenteDetailModal = false;
  selectedVenteDetail?: VenteMap;

  // QR code client
  showQrModal = false;
  selectedClientForQr?: Client;
  qrCodeDataUrl: SafeUrl | null = null;
  private qrBlobUrl: string | null = null;

  // Avances client
  showAvanceModal = false;
  showHistoriqueAvancesModal = false;
  selectedClientForAvance?: Client;
  historiqueAvances?: HistoriqueAvanceResponse;
  loadingAvance = false;
  avanceForm: AvanceClientRequest = this.emptyAvanceForm();

  // Relevé client (situation client) — paginé côté serveur
  showReleveModal = false;
  selectedClientForReleve?: Client;
  releveData?: ClientReleveResponse;
  loadingReleve = false;
  relevePeriodePreset: 'jour' | 'hier' | 'semaine' | 'mois' | 'annee' | 'personnalise' | 'tout' = 'tout';
  releveDateDebut = '';
  releveDateFin = '';
  releveTypeFilter: '' | 'VENTE' | 'VERSEMENT' = '';
  relevePage = 0;
  releveSize = 20;

  design: DesignFacture = 1;

  get boutiqueName(): string {
    return this.boutiqueConfig.getBoutiqueName() || 'Ma Boutique';
  }

  constructor(
    public clientService: ClientService,
    public venteService: VenteService,
    private auth: AuthService,
    private factureService: FactureService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private designService: FactureDesignService,
    private boutiqueConfig: BoutiqueConfigService,
    private networkStatus: NetworkStatusService,
    private offlineSync: OfflineSyncService
  ) {}

  ionViewWillEnter(): void {
    this.design = this.designService.getDesign();
    this.load();
  }

  load(event?: any): void {
    this.loading = true;
    this.clientService.getAll().subscribe({
      next: clients => {
        this.clients = clients;
        this.applyFilter();
        this.loading = false;
        event?.target?.complete();
      },
      error: error => {
        this.loading = false;
        event?.target?.complete();
        this.presentToast(error.message || 'Chargement impossible', 'danger');
      }
    });
  }

  applyFilter(): void {
    const term = this.query.trim().toLowerCase();
    this.filtered = this.clients.filter(c => !term || [
      c.nom, c.prenom, c.telephone, c.numeroTelephone, c.email
    ].filter(Boolean).some(v => `${v}`.toLowerCase().includes(term)));
  }

  startCreate(): void { this.editing = undefined; this.form = this.emptyForm(); this.showForm = true; }

  startEdit(client: Client): void { this.editing = client; this.form = { ...client }; this.showForm = true; }

  save(): void {
    if (!this.form.nom?.trim()) { this.presentToast('Le nom est obligatoire', 'danger'); return; }
    const payload = {
      nom: this.form.nom.trim(),
      prenom: this.form.prenom || '',
      numeroTelephone: this.form.numeroTelephone || this.form.telephone || '',
      adresse: this.form.adresse || '',
      email: this.form.email || ''
    };
    const endpoint = this.editing?.id ? `/api/clients/${this.editing.id}` : '/api/clients';
    const method: 'POST' | 'PUT' = this.editing?.id ? 'PUT' : 'POST';
    const actionType = this.editing?.id ? 'CLIENT_UPDATE' : 'CLIENT_CREATE';

    if (this.networkStatus.isOnline()) {
      const request = this.editing?.id
        ? this.clientService.update(this.editing.id, this.form)
        : this.clientService.create(this.form);
      request.subscribe({
        next: () => { this.presentToast(this.editing ? 'Client modifié' : 'Client créé'); this.showForm = false; this.load(); },
        error: async error => {
          if (!error.status) {
            await this.offlineSync.addOfflineAction(actionType, endpoint, method, payload);
            this.presentToast(this.editing ? '📡 Modification enregistrée hors ligne' : '📡 Client créé hors ligne');
            this.showForm = false;
            return;
          }
          this.presentToast(error.message || 'Enregistrement impossible', 'danger');
        }
      });
    } else {
      this.offlineSync.addOfflineAction(actionType, endpoint, method, payload).then(() => {
        this.presentToast(this.editing ? '📡 Modification enregistrée hors ligne — sera synchronisée' : '📡 Client créé hors ligne — sera synchronisé');
        this.showForm = false;
      });
    }
  }

  async confirmDelete(client: Client): Promise<void> {
    if (!client.id) return;
    const alert = await this.alertCtrl.create({
      header: 'Supprimer le client',
      message: this.clientService.getFullName(client),
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive', handler: () => this.delete(client.id!) }
      ]
    });
    await alert.present();
  }

  // ==================== VENTES PAR CLIENT ====================

  openVentesModal(client: Client): void {
    this.selectedClientForVentes = client;
    this.loadingVentes = true;
    this.showVentesModal = true;
    this.filterVenteType = '';

    this.venteService.getAllVentes().subscribe({
      next: ventes => {
        this.ventesClient = ventes
          .filter(v => this.isVenteForClient(v, client))
          .sort((a, b) => new Date(b.dateVente).getTime() - new Date(a.dateVente).getTime());
        this.applyVentesFilter();
        this.loadingVentes = false;
      },
      error: error => {
        this.loadingVentes = false;
        this.presentToast(error.message || 'Chargement ventes impossible', 'danger');
      }
    });
  }

  applyVentesFilter(): void {
    this.ventesFiltered = this.ventesClient.filter(v => {
      if (!this.filterVenteType) return true;
      if (this.filterVenteType === 'COMPTANT') return !v.estCredit;
      if (this.filterVenteType === 'CREDIT') return v.estCredit && !v.creditRegle;
      if (this.filterVenteType === 'CREDIT_REGLE') return v.estCredit && v.creditRegle;
      return true;
    });
  }

  getTotalVentes(): number {
    return this.ventesFiltered.reduce((s, v) => s + (v.montantTotal || 0), 0);
  }

  get creditsEnCours(): VenteMap[] {
    return this.ventesClient.filter(v => v.estCredit && !v.creditRegle);
  }

  getTotalCreditsTotal(): number {
    return this.creditsEnCours.reduce((s, v) => s + (v.montantTotal || 0), 0);
  }

  getTotalCreditsRestant(): number {
    return this.creditsEnCours.reduce((s, v) => s + this.getMontantRestant(v), 0);
  }

  getTotalCreditsVerse(): number {
    return this.creditsEnCours.reduce((s, v) => s + (v.montantVerse || 0), 0);
  }

  getMontantRestant(v: VenteMap): number {
    if (v.montantRestant != null) return v.montantRestant;
    return Math.max(0, (v.montantTotal || 0) - (v.montantVerse || 0));
  }

  getPourcentagePaiement(v: VenteMap): number {
    if (!v.montantTotal) return 0;
    return Math.min(100, Math.round(((v.montantVerse || 0) / v.montantTotal) * 100));
  }

  closeVentesModal(): void {
    this.showVentesModal = false;
    this.ventesClient = [];
    this.ventesFiltered = [];
    this.selectedClientForVentes = undefined;
  }

  isCreditEnRetard(v: VenteMap): boolean {
    if (!v.estCredit || !v.dateEcheance || v.creditRegle) return false;
    return new Date(v.dateEcheance) < new Date();
  }

  getVenteBadgeColor(v: VenteMap): string {
    if (v.annulee) return 'medium';
    if (!v.estCredit) return 'success';
    if (v.creditRegle) return 'primary';
    if (this.isCreditEnRetard(v)) return 'danger';
    return 'warning';
  }

  getVenteBadgeLabel(v: VenteMap): string {
    if (v.annulee) return 'Annulée';
    if (!v.estCredit) return 'Comptant';
    if (v.creditRegle) return 'Réglé';
    if (this.isCreditEnRetard(v)) return 'En retard';
    return 'Crédit';
  }

  // ==================== RELEVÉ CLIENT (situation client, JSON paginé) ====================

  openReleveModal(client: Client): void {
    if (!client.id) return;
    this.selectedClientForReleve = client;
    this.releveData = undefined;
    this.relevePeriodePreset = 'tout';
    this.releveDateDebut = '';
    this.releveDateFin = '';
    this.releveTypeFilter = '';
    this.relevePage = 0;
    this.showReleveModal = true;
    this.loadReleve();
  }

  loadReleve(): void {
    if (!this.selectedClientForReleve?.id) return;
    this.loadingReleve = true;
    const dd = this.relevePeriodePreset !== 'tout' ? this.releveDateDebut : undefined;
    const df = this.relevePeriodePreset !== 'tout' ? this.releveDateFin : undefined;
    this.clientService.getReleve(
      this.selectedClientForReleve.id, this.relevePage, this.releveSize,
      dd || undefined, df || undefined, this.releveTypeFilter || undefined
    ).subscribe({
      next: data => { this.releveData = data; this.loadingReleve = false; },
      error: error => { this.loadingReleve = false; this.presentToast(error.message || 'Chargement du relevé impossible', 'danger'); }
    });
  }

  appliquerRelevePreset(preset: 'jour' | 'hier' | 'semaine' | 'mois' | 'annee' | 'personnalise' | 'tout'): void {
    this.relevePeriodePreset = preset;
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();

    if (preset === 'jour') {
      this.releveDateDebut = toIso(today);
      this.releveDateFin = toIso(today);
    } else if (preset === 'hier') {
      const hier = new Date(today);
      hier.setDate(hier.getDate() - 1);
      this.releveDateDebut = toIso(hier);
      this.releveDateFin = toIso(hier);
    } else if (preset === 'semaine') {
      const jour = today.getDay() === 0 ? 7 : today.getDay();
      const debut = new Date(today);
      debut.setDate(debut.getDate() - (jour - 1));
      this.releveDateDebut = toIso(debut);
      this.releveDateFin = toIso(today);
    } else if (preset === 'mois') {
      const debut = new Date(today.getFullYear(), today.getMonth(), 1);
      this.releveDateDebut = toIso(debut);
      this.releveDateFin = toIso(today);
    } else if (preset === 'annee') {
      const debut = new Date(today.getFullYear(), 0, 1);
      this.releveDateDebut = toIso(debut);
      this.releveDateFin = toIso(today);
    } else if (preset === 'tout') {
      this.releveDateDebut = '';
      this.releveDateFin = '';
    }
    // 'personnalise' : dates saisies manuellement, rien à calculer ici

    if (preset !== 'personnalise') {
      this.relevePage = 0;
      this.loadReleve();
    }
  }

  appliquerRelevePeriodePersonnalisee(): void {
    if (!this.releveDateDebut || !this.releveDateFin) {
      this.presentToast('Sélectionnez une date de début et de fin', 'danger');
      return;
    }
    if (this.releveDateDebut > this.releveDateFin) {
      this.presentToast('La date de début doit précéder la date de fin', 'danger');
      return;
    }
    this.relevePeriodePreset = 'personnalise';
    this.relevePage = 0;
    this.loadReleve();
  }

  changerReleveType(type: '' | 'VENTE' | 'VERSEMENT'): void {
    this.releveTypeFilter = type;
    this.relevePage = 0;
    this.loadReleve();
  }

  relevePagePrecedente(): void {
    if (this.relevePage <= 0) return;
    this.relevePage--;
    this.loadReleve();
  }

  relevePageSuivante(): void {
    if (!this.releveData || this.relevePage >= this.releveData.totalPages - 1) return;
    this.relevePage++;
    this.loadReleve();
  }

  closeReleveModal(): void {
    this.showReleveModal = false;
    this.selectedClientForReleve = undefined;
    this.releveData = undefined;
  }

  releveLigneBadgeColor(ligne: ClientReleveLigne): string {
    if (ligne.type === 'VENTE') return 'primary';
    if (ligne.type === 'RETOUR') return 'warning';
    return 'success';
  }

  releveLigneBadgeLabel(ligne: ClientReleveLigne): string {
    if (ligne.type === 'VENTE') return 'Vente';
    if (ligne.type === 'RETOUR') return 'Retour';
    return 'Versement';
  }

  formatHeure(value: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  // ==================== DÉTAIL VENTE ====================

  openVenteDetail(v: VenteMap): void {
    this.selectedVenteDetail = v;
    this.showVenteDetailModal = true;
  }

  closeVenteDetail(): void {
    this.showVenteDetailModal = false;
    this.selectedVenteDetail = undefined;
  }

  // ==================== PDF PAR FACTURE ====================

  telechargerFacturePdf(venteId: number): void {
    this.factureService.obtenirFacturesParVente(venteId).subscribe({
      next: factures => {
        if (factures.length > 0) {
          window.location.href = window.location.origin + `/api/caisse/factures/${factures[0].id}/pdf`;
        } else {
          const userId = this.auth.getUserId();
          this.factureService.creerFactureDepuisVente(venteId, null, userId).subscribe({
            next: facture => {
              window.location.href = window.location.origin + `/api/caisse/factures/${facture.id}/pdf`;
            },
            error: err => this.presentToast(err.message || 'Impossible de créer la facture', 'danger')
          });
        }
      },
      error: err => this.presentToast(err.message || 'Impossible de charger les factures', 'danger')
    });
  }

  telechargerReleve(clientId?: number): void {
    if (!clientId) return;
    window.open(`/api/clients/${clientId}/releve-pdf`, '_blank');
  }

  // ==================== QR CODE CLIENT ====================

  showQrCode(client: Client): void {
    this.selectedClientForQr = client;
    this.qrCodeDataUrl = null;
    this.showQrModal = true;
    if (client.id) {
      this.http.get(`/api/clients/${client.id}/qrcode`, { responseType: 'blob' }).subscribe({
        next: blob => {
          if (this.qrBlobUrl) URL.revokeObjectURL(this.qrBlobUrl);
          this.qrBlobUrl = URL.createObjectURL(blob);
          this.qrCodeDataUrl = this.sanitizer.bypassSecurityTrustUrl(this.qrBlobUrl);
        },
        error: () => { this.qrCodeDataUrl = null; }
      });
    }
  }

  closeQrModal(): void {
    this.showQrModal = false;
    this.selectedClientForQr = undefined;
    if (this.qrBlobUrl) { URL.revokeObjectURL(this.qrBlobUrl); this.qrBlobUrl = null; }
    this.qrCodeDataUrl = null;
  }

  getQrCodeUrl(clientId?: number): string {
    return clientId ? `/api/clients/${clientId}/qrcode` : '';
  }

  telechargerQrCode(client: Client): void {
    if (!client.id) return;
    const link = document.createElement('a');
    link.href = `/api/clients/${client.id}/qrcode`;
    link.download = `qr-${client.nom}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==================== AVANCES CLIENT ====================

  openAvanceModal(client: Client): void {
    this.selectedClientForAvance = client;
    this.avanceForm = {
      clientNom: client.nom,
      clientTelephone: client.telephone || client.numeroTelephone || '',
      montant: 0, motif: '', modePaiement: 'ESPECES', referencePaiement: '',
      utilisateurId: this.auth.getUserId()
    };
    this.showAvanceModal = true;
  }

  enregistrerAvance(): void {
    if (!this.avanceForm.montant || this.avanceForm.montant <= 0) {
      this.presentToast('Montant invalide', 'danger'); return;
    }
    this.loadingAvance = true;
    this.clientService.enregistrerAvance(this.avanceForm).subscribe({
      next: res => { this.loadingAvance = false; this.showAvanceModal = false; this.presentToast(res.message || 'Avance enregistrée'); },
      error: err => { this.loadingAvance = false; this.presentToast(err.message || 'Enregistrement avance impossible', 'danger'); }
    });
  }

  openHistoriqueAvancesModal(client: Client): void {
    this.selectedClientForAvance = client;
    this.loadingAvance = true;
    this.showHistoriqueAvancesModal = true;
    const tel = client.telephone || client.numeroTelephone || '';
    this.clientService.getHistoriqueAvances(client.nom, tel).subscribe({
      next: res => { this.historiqueAvances = res; this.loadingAvance = false; },
      error: err => { this.loadingAvance = false; this.presentToast(err.message || 'Historique avances impossible', 'danger'); }
    });
  }

  closeHistoriqueAvancesModal(): void {
    this.showHistoriqueAvancesModal = false;
    this.historiqueAvances = undefined;
    this.selectedClientForAvance = undefined;
  }

  getStatutAvanceBadge(statut: string): string {
    switch (statut) {
      case 'DISPONIBLE': return 'success';
      case 'UTILISE_PARTIELLEMENT': return 'warning';
      default: return 'medium';
    }
  }

  // ==================== UTILITAIRES ====================

  money(value: number): string { return this.venteService.formatPrice(value); }
  formatDate(value: string): string { return this.venteService.formatDate(value); }

  private isVenteForClient(vente: VenteMap, client: Client): boolean {
    if (client.id && vente.clientId && vente.clientId === client.id) return true;
    const clientPhone = (client.numeroTelephone || client.telephone || '').replace(/\D/g, '');
    const ventePhone = (vente.clientTelephone || '').replace(/\D/g, '');
    if (clientPhone && ventePhone && clientPhone === ventePhone) return true;
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    return normalize(vente.clientNom || '') === normalize(client.nom || '');
  }

  private delete(id: number): void {
    this.clientService.delete(id).subscribe({
      next: () => { this.presentToast('Client supprimé'); this.load(); },
      error: error => this.presentToast(error.message || 'Suppression impossible', 'danger')
    });
  }

  private emptyForm(): Client {
    return { nom: '', prenom: '', telephone: '', numeroTelephone: '', adresse: '', email: '' };
  }

  private emptyAvanceForm(): AvanceClientRequest {
    return { clientNom: '', clientTelephone: '', montant: 0, motif: '', modePaiement: 'ESPECES', referencePaiement: '' };
  }

  private async presentToast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await toast.present();
  }
}
