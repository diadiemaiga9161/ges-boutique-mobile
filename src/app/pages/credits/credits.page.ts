import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CaisseService, CreditInfo, ModePaiementCaisse, ReglementCreditRequest } from '../../services/caisse.service';
import { VenteService, VenteMap } from '../../services/vente.service';

interface ClientGroup {
  clientNom: string;
  clientTelephone?: string;
  credits: CreditInfo[];
  totalRestant: number;
  enRetard: boolean;
  selected: boolean;
  expanded: boolean;
}

@Component({
  selector: 'app-credits',
  templateUrl: './credits.page.html',
  styleUrls: ['./credits.page.scss'],
  standalone: false
})
export class CreditsPage {
  groups: ClientGroup[] = [];
  filteredGroups: ClientGroup[] = [];
  loading = false;
  searchTerm = '';
  filterRetard = false;

  // Modal détail crédit (lecture seule — produits achetés)
  showDetailModal = false;
  detailCredit?: CreditInfo;
  detailVente?: VenteMap;
  loadingDetail = false;

  // Modal règlement simple
  showSimpleModal = false;
  selectedCredit?: CreditInfo;
  selectedVente?: VenteMap;
  loadingVente = false;
  reglementSimple = { montant: 0, modePaiement: ModePaiementCaisse.ESPECES, reference: '' };
  savingSimple = false;

  // Modal règlement groupé
  showGroupModal = false;
  selectedGroup?: ClientGroup;
  selectedCreditIds: Set<number> = new Set();
  reglementGroupe = { montant: 0, modePaiement: ModePaiementCaisse.ESPECES, reference: '' };
  savingGroupe = false;

  ModePaiementCaisse = ModePaiementCaisse;

  constructor(
    private caisseService: CaisseService,
    private venteService: VenteService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: any): void {
    this.loading = true;
    this.caisseService.getCreditsNonRegles().subscribe({
      next: credits => {
        const actifs = credits.filter(c => !c.venteAnnulee && !c.estReglee);
        this.groups = this.buildGroups(actifs);
        this.applyFilter();
        this.loading = false;
        event?.target?.complete();
      },
      error: () => { this.loading = false; event?.target?.complete(); }
    });
  }

  private buildGroups(credits: CreditInfo[]): ClientGroup[] {
    const map = new Map<string, CreditInfo[]>();
    credits.forEach(c => {
      const key = c.clientNom;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });

    return Array.from(map.entries()).map(([nom, list]) => ({
      clientNom: nom,
      clientTelephone: list[0].clientTelephone,
      credits: list,
      totalRestant: list.reduce((s, c) => s + c.montantRestant, 0),
      enRetard: list.some(c => c.enRetard),
      selected: false,
      expanded: false
    })).sort((a, b) => b.totalRestant - a.totalRestant);
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredGroups = this.groups.filter(g => {
      if (this.filterRetard && !g.enRetard) return false;
      if (term) return g.clientNom.toLowerCase().includes(term) ||
        (g.clientTelephone || '').includes(term);
      return true;
    });
  }

  toggleGroup(g: ClientGroup): void {
    g.expanded = !g.expanded;
  }

  // ══════════════ RÈGLEMENT SIMPLE ══════════════

  openDetail(credit: CreditInfo): void {
    this.detailCredit = credit;
    this.detailVente = undefined;
    this.showDetailModal = true;
    this.loadingDetail = true;
    this.venteService.getVenteById(credit.venteId).subscribe({
      next: v => { this.detailVente = v; this.loadingDetail = false; },
      error: () => { this.loadingDetail = false; }
    });
  }

  openSimple(credit: CreditInfo): void {
    this.selectedCredit = credit;
    this.selectedVente = undefined;
    this.reglementSimple = { montant: credit.montantRestant, modePaiement: ModePaiementCaisse.ESPECES, reference: '' };
    this.showSimpleModal = true;
    this.loadVenteDetails(credit.venteId);
  }

  private loadVenteDetails(venteId: number): void {
    this.loadingVente = true;
    this.venteService.getVenteById(venteId).subscribe({
      next: v => { this.selectedVente = v; this.loadingVente = false; },
      error: () => { this.loadingVente = false; }
    });
  }

  saveSimple(): void {
    if (!this.selectedCredit) return;
    if (!this.reglementSimple.montant || this.reglementSimple.montant <= 0) {
      this.toast('Le montant doit être supérieur à 0', 'danger'); return;
    }
    if (this.reglementSimple.montant > this.selectedCredit.montantRestant) {
      this.toast(`Montant max : ${this.money(this.selectedCredit.montantRestant)}`, 'danger'); return;
    }

    this.savingSimple = true;
    const req: ReglementCreditRequest = {
      venteCreditId: this.selectedCredit.venteId,
      montantRegle: this.reglementSimple.montant,
      modePaiement: this.reglementSimple.modePaiement,
      referencePaiement: this.reglementSimple.reference || undefined,
      utilisateurId: this.auth.getUserId()
    };

    this.caisseService.reglementCredit(req).subscribe({
      next: () => {
        this.savingSimple = false;
        this.showSimpleModal = false;
        this.toast('Règlement enregistré ✓');
        this.load();
      },
      error: err => {
        this.savingSimple = false;
        this.toast(err.message || 'Règlement impossible', 'danger');
      }
    });
  }

  // ══════════════ RÈGLEMENT GROUPÉ ══════════════

  openGroupe(group: ClientGroup): void {
    this.selectedGroup = group;
    this.selectedCreditIds = new Set(group.credits.map(c => c.venteId));
    this.reglementGroupe = { montant: this.getGroupTotal(), modePaiement: ModePaiementCaisse.ESPECES, reference: '' };
    this.showGroupModal = true;
  }

  toggleCreditSelection(venteId: number): void {
    if (this.selectedCreditIds.has(venteId)) {
      this.selectedCreditIds.delete(venteId);
    } else {
      this.selectedCreditIds.add(venteId);
    }
    this.reglementGroupe.montant = this.getGroupTotal();
  }

  isCreditSelected(venteId: number): boolean {
    return this.selectedCreditIds.has(venteId);
  }

  getGroupTotal(): number {
    return (this.selectedGroup?.credits || [])
      .filter(c => this.selectedCreditIds.has(c.venteId))
      .reduce((s, c) => s + c.montantRestant, 0);
  }

  get selectedCreditsForGroup(): CreditInfo[] {
    return (this.selectedGroup?.credits || []).filter(c => this.selectedCreditIds.has(c.venteId));
  }

  async saveGroupe(): Promise<void> {
    const creditsARegler = this.selectedCreditsForGroup;
    if (!creditsARegler.length) {
      this.toast('Sélectionnez au moins un crédit', 'danger'); return;
    }
    if (!this.reglementGroupe.montant || this.reglementGroupe.montant <= 0) {
      this.toast('Le montant doit être supérieur à 0', 'danger'); return;
    }

    const total = this.getGroupTotal();
    const alert = await this.alertCtrl.create({
      header: 'Confirmer le règlement groupé',
      message: `${creditsARegler.length} crédit(s) — <strong>${this.money(this.reglementGroupe.montant)}</strong>`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Confirmer',
          cssClass: 'alert-btn-primary',
          handler: () => {
            this.savingGroupe = true;
            // Distribuer le montant proportionnellement si montant < total
            const ratio = this.reglementGroupe.montant / total;
            const reglements = creditsARegler.map(c => {
              const montant = Math.round(c.montantRestant * ratio);
              const req: ReglementCreditRequest = {
                venteCreditId: c.venteId,
                montantRegle: montant,
                modePaiement: this.reglementGroupe.modePaiement,
                referencePaiement: this.reglementGroupe.reference || undefined,
                utilisateurId: this.auth.getUserId()
              };
              return this.caisseService.reglementCredit(req);
            });

            forkJoin(reglements).subscribe({
              next: () => {
                this.savingGroupe = false;
                this.showGroupModal = false;
                this.toast(`${creditsARegler.length} règlement(s) enregistré(s) ✓`);
                this.load();
              },
              error: err => {
                this.savingGroupe = false;
                this.toast(err.message || 'Erreur lors du règlement groupé', 'danger');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ══════════════ UTILITAIRES ══════════════

  get totalCredits(): number {
    return this.groups.reduce((s, g) => s + g.totalRestant, 0);
  }

  get nbClients(): number {
    return this.groups.length;
  }

  get nbCreditsEnRetard(): number {
    return this.groups.filter(g => g.enRetard).length;
  }

  money(v: number): string {
    return this.caisseService.formatPrice(v);
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2400, position: 'top' });
    await t.present();
  }
}
