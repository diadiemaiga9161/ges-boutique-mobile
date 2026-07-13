import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { forkJoin, from } from 'rxjs';
import { concatMap, toArray } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { CaisseService, CreditInfo, ModePaiementCaisse, ReglementCreditRequest, OperationCaisse } from '../../services/caisse.service';
import { VenteService, VenteMap } from '../../services/vente.service';
import { FactureService } from '../../services/facture.service';
import { BoutiqueService } from '../../services/boutique.service';

interface ClientGroup {
  clientNom: string;
  clientPrenom?: string;
  clientTelephone?: string;
  credits: CreditInfo[];
  totalRestant: number;
  enRetard: boolean;
  selected: boolean;
  expanded: boolean;
}

type StatutFilter = 'EN_COURS' | 'REGLES' | 'TOUS';

@Component({
  selector: 'app-credits',
  templateUrl: './credits.page.html',
  styleUrls: ['./credits.page.scss'],
  standalone: false
})
export class CreditsPage {
  allCredits: CreditInfo[] = [];
  groups: ClientGroup[] = [];
  filteredGroups: ClientGroup[] = [];
  loading = false;
  searchTerm = '';
  filterRetard = false;
  statutFilter: StatutFilter = 'EN_COURS';

  // ── Filtre par plage de dates ──────────────────────────────
  dateDebut: string = '';
  dateFin: string = '';

  // ── Filtre par client ──────────────────────────────────────
  clientSelectionne: string = '';
  clientsUniques: string[] = [];

  // ── Pagination ────────────────────────────────────────────
  pageActuelle: number = 1;
  itemsParPage: number = 10;

  // Modal détail crédit
  showDetailModal = false;
  detailCredit?: CreditInfo;
  detailVente?: VenteMap;
  loadingDetail = false;
  versements: OperationCaisse[] = [];
  versementsLoading = false;

  // ── Paiements groupés dans modal détail ───────────────────
  versementsSimples: OperationCaisse[] = [];
  paiementsGroupesDetail: Map<string, OperationCaisse[]> = new Map();
  rechercheVersement: string = '';

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

  // ── Onglet paiements groupés ──────────────────────────────
  activeTab: 'credits' | 'groupes' = 'credits';
  paiementsGroupes: any[] = [];
  paiementsGroupesLoading = false;
  expandedGroupes = new Set<string>();

  // ── Filtres onglet paiements groupés ─────────────────────
  rechercheGroupe: string = '';
  dateDebutGroupe: string = '';
  dateFinGroupe: string = '';
  clientGroupeSelectionne: string = '';

  get clientsGroupesUniques(): string[] {
    const noms = (this.paiementsGroupes || []).map((g: any) => g.clientNom || g.client || '').filter(Boolean);
    return [...new Set<string>(noms)].sort((a: string, b: string) => a.localeCompare(b, 'fr'));
  }

  get paiementsGroupesFiltres(): any[] {
    return (this.paiementsGroupes || []).filter((g: any) => {
      const client = g.clientNom || g.client || '';
      const date = g.date || g.dateOperation || '';
      const matchRecherche = !this.rechercheGroupe || client.toLowerCase().includes(this.rechercheGroupe.toLowerCase());
      const matchClient = !this.clientGroupeSelectionne || client === this.clientGroupeSelectionne;
      const matchDebut = !this.dateDebutGroupe || date >= this.dateDebutGroupe;
      const matchFin = !this.dateFinGroupe || date <= this.dateFinGroupe + 'T23:59:59';
      return matchRecherche && matchClient && matchDebut && matchFin;
    });
  }

  trackById = (_: number, item: any) => item.id;

  constructor(
    private caisseService: CaisseService,
    private venteService: VenteService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private factureService: FactureService,
    private boutiqueService: BoutiqueService
  ) {}

  ionViewWillEnter(): void {
    this.load();
    this.loadPaiementsGroupes();
  }

  load(event?: any): void {
    this.loading = true;
    const boutiqueId = this.boutiqueService.getInfo().id || 0;
    forkJoin({
      nonRegles: this.caisseService.getCreditsNonRegles(),
      regles: this.caisseService.getCreditsRegles(),
      creditsActifs: this.venteService.getCreditsActifs(boutiqueId)
    }).subscribe({
      next: ({ nonRegles, regles, creditsActifs }) => {
        const caisseMap = new Map<number, CreditInfo>();
        [...nonRegles, ...regles].forEach(c => { if (c.venteId) caisseMap.set(c.venteId, c); });
        this.allCredits = creditsActifs
          .map(v => {
            const c = caisseMap.get(v.id);
            if (c) {
              const montantRestant = c.montantRestant ?? Math.max(0, (v.montantTotal || 0) - (v.montantVerse || 0));
              const estReglee = c.estReglee || !!v.creditRegle || montantRestant <= 0.01;
              return { ...c, montantRestant, estReglee };
            }
            return this.venteMapToCredit(v);
          });
        this.buildClientsUniques();
        this.applyStatutFilter();
        this.loading = false;
        event?.target?.complete();
      },
      error: () => { this.loading = false; event?.target?.complete(); }
    });
  }

  loadPaiementsGroupes() {
    this.paiementsGroupesLoading = true;
    this.caisseService.getPaiementsGroupes().subscribe({
      next: (data) => {
        this.paiementsGroupes = data;
        this.paiementsGroupesLoading = false;
      },
      error: () => { this.paiementsGroupesLoading = false; }
    });
  }

  toggleGroupe(ref: string) {
    if (this.expandedGroupes.has(ref)) {
      this.expandedGroupes.delete(ref);
    } else {
      this.expandedGroupes.add(ref);
    }
  }

  private venteMapToCredit(v: VenteMap): CreditInfo {
    const montantTotal = v.montantTotal || 0;
    const montantVerse = v.montantVerse || 0;
    const montantRestant = v.montantRestant ?? Math.max(0, montantTotal - montantVerse);
    const echeance = v.dateEcheance ? new Date(v.dateEcheance) : null;
    const maintenant = new Date();
    const estReglee = !!v.creditRegle || montantRestant <= 0;
    const enRetard = !estReglee && echeance ? echeance < maintenant : false;
    const joursRetard = enRetard && echeance
      ? Math.ceil((maintenant.getTime() - echeance.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    return {
      id: v.id, venteId: v.id, numeroVente: v.numeroVente || '',
      clientNom: v.clientNom || 'Client divers',
      clientPrenom: v.clientPrenom, clientTelephone: v.clientTelephone || '',
      montantTotal, montantVerse, montantRestant,
      dateOperation: v.dateVente || '', dateEcheance: v.dateEcheance || '',
      dateReglement: v.dateReglement, estReglee, enRetard, joursRetard,
      progression: montantTotal > 0 ? Math.min((montantVerse / montantTotal) * 100, 99) : 0,
      venteAnnulee: v.annulee || false
    };
  }

  // ── Clients uniques ─────────────────────────────────────────
  private buildClientsUniques(): void {
    const noms = new Set<string>();
    this.allCredits.forEach(c => { if (c.clientNom) noms.add(c.clientNom); });
    this.clientsUniques = Array.from(noms).sort((a, b) => a.localeCompare(b, 'fr'));
  }

  setStatut(s: StatutFilter): void {
    this.statutFilter = s;
    this.filterRetard = false;
    this.pageActuelle = 1;
    this.applyStatutFilter();
  }

  private applyStatutFilter(): void {
    let filtered: CreditInfo[];
    if (this.statutFilter === 'EN_COURS') {
      filtered = this.allCredits.filter(c => !c.estReglee);
    } else if (this.statutFilter === 'REGLES') {
      filtered = this.allCredits.filter(c => !!c.estReglee);
    } else {
      filtered = [...this.allCredits];
    }
    this.groups = this.buildGroups(filtered);
    this.applyFilter();
  }

  private buildGroups(credits: CreditInfo[]): ClientGroup[] {
    const map = new Map<string, CreditInfo[]>();
    credits.forEach(c => {
      const key = `${c.clientNom}__${c.clientTelephone || ''}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });

    return Array.from(map.entries()).map(([, list]) => ({
      clientNom: list[0].clientNom,
      clientPrenom: list[0].clientPrenom,
      clientTelephone: list[0].clientTelephone,
      credits: list,
      totalRestant: list.reduce((s, c) => s + (c.estReglee ? 0 : c.montantRestant), 0),
      enRetard: list.some(c => c.enRetard),
      selected: false,
      expanded: false
    })).sort((a, b) => b.totalRestant - a.totalRestant);
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    const debut = this.dateDebut ? new Date(this.dateDebut) : null;
    const fin = this.dateFin ? new Date(this.dateFin + 'T23:59:59') : null;

    this.filteredGroups = this.groups.filter(g => {
      // Filtre retard
      if (this.filterRetard && !g.enRetard) return false;
      // Filtre par client sélectionné
      if (this.clientSelectionne && g.clientNom !== this.clientSelectionne) return false;
      // Filtre texte
      if (term) {
        const nom = (g.clientNom + ' ' + (g.clientPrenom || '')).toLowerCase();
        if (!nom.includes(term) && !(g.clientTelephone || '').includes(term)) return false;
      }
      // Filtre par date : au moins un crédit du groupe dans la plage
      if (debut || fin) {
        const creditsDansPeriode = g.credits.filter(c => {
          const d = c.dateOperation ? new Date(c.dateOperation) : null;
          if (!d) return false;
          if (debut && d < debut) return false;
          if (fin && d > fin) return false;
          return true;
        });
        if (!creditsDansPeriode.length) return false;
      }
      return true;
    });

    this.pageActuelle = 1;
  }

  // ── Réinitialiser dates ─────────────────────────────────────
  effacerDates(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.pageActuelle = 1;
    this.applyFilter();
  }

  // ── Pagination ──────────────────────────────────────────────
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredGroups.length / this.itemsParPage));
  }

  get groupesPagines(): ClientGroup[] {
    const debut = (this.pageActuelle - 1) * this.itemsParPage;
    return this.filteredGroups.slice(debut, debut + this.itemsParPage);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const actuelle = this.pageActuelle;
    const rayon = 2;
    const pages: number[] = [];
    for (let i = Math.max(1, actuelle - rayon); i <= Math.min(total, actuelle + rayon); i++) {
      pages.push(i);
    }
    return pages;
  }

  allerPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.pageActuelle = page;
    // Remonter en haut de la liste
    const el = document.querySelector('.credits-list');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  toggleGroup(g: ClientGroup): void {
    g.expanded = !g.expanded;
  }

  // ══════════════ RÈGLEMENT SIMPLE ══════════════

  openDetail(credit: CreditInfo): void {
    this.detailCredit = credit;
    this.detailVente = undefined;
    this.versements = [];
    this.versementsSimples = [];
    this.paiementsGroupesDetail = new Map();
    this.rechercheVersement = '';
    this.showDetailModal = true;
    this.loadingDetail = true;
    this.versementsLoading = true;
    forkJoin({
      vente: this.venteService.getVenteById(credit.venteId),
      vers: this.caisseService.getHistoriqueReglementsCredit(credit.venteId)
    }).subscribe({
      next: ({ vente, vers }) => {
        this.detailVente = vente;
        this.versements = vers;
        this.buildVersementsGroupesDetail(vers);
        this.loadingDetail = false;
        this.versementsLoading = false;
      },
      error: () => {
        this.loadingDetail = false;
        this.versementsLoading = false;
      }
    });
  }

  /** Sépare les versements simples des paiements groupés dans le modal détail */
  private buildVersementsGroupesDetail(vers: OperationCaisse[]): void {
    this.versementsSimples = vers.filter(v => !v.referenceGroupe);
    const grouped = vers.filter(v => !!v.referenceGroupe);
    const map = new Map<string, OperationCaisse[]>();
    grouped.forEach(v => {
      const ref = v.referenceGroupe!;
      if (!map.has(ref)) map.set(ref, []);
      map.get(ref)!.push(v);
    });
    this.paiementsGroupesDetail = map;
  }

  /** Versements simples filtrés par rechercheVersement */
  get versementsFiltres(): OperationCaisse[] {
    const term = this.rechercheVersement.trim().toLowerCase();
    if (!term) return this.versementsSimples;
    return this.versementsSimples.filter(v =>
      (v.modePaiement || '').toLowerCase().includes(term) ||
      (v.referencePaiement || '').toLowerCase().includes(term) ||
      (v.utilisateurNom || '').toLowerCase().includes(term) ||
      this.formatDate(v.dateOperation).includes(term) ||
      this.money(v.montant).includes(term)
    );
  }

  /** Clés des groupes dans le modal détail */
  get groupesDetailKeys(): string[] {
    return Array.from(this.paiementsGroupesDetail.keys());
  }

  /** Montant total d'un groupe */
  montantTotalGroupe(ref: string): number {
    return (this.paiementsGroupesDetail.get(ref) || []).reduce((s, v) => s + v.montant, 0);
  }

  /** Référence courte (8 premiers caractères) */
  refCourte(ref: string): string {
    return ref.length > 8 ? ref.substring(0, 8).toUpperCase() + '…' : ref.toUpperCase();
  }

  /** Date du premier versement d'un groupe */
  dateGroupe(ref: string): string {
    const vers = this.paiementsGroupesDetail.get(ref) || [];
    return vers.length ? this.formatDate(vers[0].dateOperation) : '—';
  }

  openSimple(credit: CreditInfo): void {
    if (credit.estReglee) return;
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

    const creditPourRecu = this.selectedCredit;
    const montantRegle = this.reglementSimple.montant;
    const modePaiement = this.reglementSimple.modePaiement;

    this.caisseService.reglementCredit(req).subscribe({
      next: () => {
        this.savingSimple = false;
        this.showSimpleModal = false;
        this.toast('Règlement enregistré ✓');
        this.load();
        if (creditPourRecu) {
          const reglementData = {
            montant: montantRegle,
            modePaiement,
            datePaiement: new Date().toISOString(),
            montantRestant: Math.max(0, creditPourRecu.montantRestant - montantRegle)
          };
          const client = {
            nom: creditPourRecu.clientNom,
            prenom: creditPourRecu.clientPrenom,
            telephone: creditPourRecu.clientTelephone
          };
          this.factureService.ouvrirRecuReglementCredit(reglementData, client);
        }
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
    this.selectedCreditIds = new Set(group.credits.filter(c => !c.estReglee).map(c => c.venteId));
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
      .filter(c => !c.estReglee && this.selectedCreditIds.has(c.venteId))
      .reduce((s, c) => s + c.montantRestant, 0);
  }

  get selectedCreditsForGroup(): CreditInfo[] {
    return (this.selectedGroup?.credits || []).filter(c => !c.estReglee && this.selectedCreditIds.has(c.venteId));
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
            const ratio = this.reglementGroupe.montant / total;
            const montantTotalApporte = this.reglementGroupe.montant;
            const refGroupe = (typeof crypto !== 'undefined' && crypto.randomUUID)
              ? crypto.randomUUID()
              : Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
            let reste = this.reglementGroupe.montant;
            const requests: ReglementCreditRequest[] = creditsARegler.map((c, index) => {
              const isLast = index === creditsARegler.length - 1;
              const montant = isLast
                ? Math.min(reste, c.montantRestant)
                : Math.min(Math.round(c.montantRestant * ratio), c.montantRestant);
              reste -= montant;
              return {
                venteCreditId: c.venteId,
                montantRegle: montant,
                modePaiement: this.reglementGroupe.modePaiement,
                referencePaiement: this.reglementGroupe.reference || undefined,
                utilisateurId: this.auth.getUserId(),
                motif: `Paiement groupé | Total apporté: ${montantTotalApporte}`,
                referenceGroupe: refGroupe
              };
            });

            from(requests).pipe(
              concatMap(req => this.caisseService.reglementCredit(req)),
              toArray()
            ).subscribe({
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

  // ══════════════ PAIEMENT GROUPÉ — HELPERS AFFICHAGE ══════════════

  /** Renvoie le premier versement contenant un motif "Paiement groupé", ou undefined. */
  getVersementGroupe(): OperationCaisse | undefined {
    return this.versements.find(v => (v.motif || '').includes('Paiement groupé'));
  }

  /** Extrait le montant total apporté depuis le motif d'un versement groupé. */
  extractMontantGroupeApporte(motif: string): number {
    const match = motif.match(/Total apporté:\s*([\d\s]+)/);
    if (!match) return 0;
    return parseInt(match[1].replace(/\s/g, ''), 10) || 0;
  }

  // ══════════════ REÇU ══════════════

  imprimerRecuCredit(credit: CreditInfo): void {
    const reglementData = {
      montant: credit.montantVerse,
      modePaiement: 'ESPECES',
      datePaiement: credit.dateReglement || new Date().toISOString(),
      montantRestant: 0
    };
    const client = {
      nom: credit.clientNom,
      prenom: credit.clientPrenom,
      telephone: credit.clientTelephone
    };
    this.factureService.ouvrirRecuReglementCredit(reglementData, client);
  }

  // ══════════════ UTILITAIRES ══════════════

  get totalCreditsEnCours(): number {
    return this.allCredits.filter(c => !c.estReglee).reduce((s, c) => s + c.montantRestant, 0);
  }

  get nbClients(): number {
    return new Set(this.allCredits.filter(c => !c.estReglee).map(c => c.clientNom)).size;
  }

  get nbCreditsEnRetard(): number {
    return this.allCredits.filter(c => c.enRetard).length;
  }

  get nbCreditsRegles(): number {
    return this.allCredits.filter(c => c.estReglee).length;
  }

  money(v: number): string {
    return this.caisseService.formatPrice(v);
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }

  imprimerVersementsCredit(): void {
    const credit = this.detailCredit;
    if (!credit) return;
    const vers = this.versements;
    const boutique = this.boutiqueService.getInfo();
    const boutiqueName = boutique?.nom || 'Ges Boutique';
    const qrData = encodeURIComponent(`CREDIT_N${credit.numeroVente}_${credit.clientNom}_VERSE_${credit.montantVerse}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;

    const isGrouped = vers.some(v => (v.motif || '').toLowerCase().includes('group'));
    const groupBadge = isGrouped ? `<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700">Paiement groupé inclus</span>` : '';

    const versRows = vers.length ? vers.map((v, i) =>
      `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td>${this.formatDate(v.dateOperation)}</td>
        <td style="text-align:right;font-weight:700;color:#166534">${this.money(v.montant)}</td>
        <td>${v.modePaiement || 'ESPECES'}</td>
        <td>${v.referencePaiement || '—'}</td>
        <td>${v.utilisateurNom || '—'}</td>
        <td>${v.motif || '—'}</td>
        <td>${v.referenceGroupe ? `<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700">GROUPÉ</span>` : '—'}</td>
      </tr>`
    ).join('') : `<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:14px">Aucun versement</td></tr>`;

    // Section paiements groupés PDF
    let groupesSectionHtml = '';
    if (this.paiementsGroupesDetail.size > 0) {
      const groupesRows = Array.from(this.paiementsGroupesDetail.entries()).map(([ref, ops]) => {
        const total = ops.reduce((s, o) => s + o.montant, 0);
        const dateRef = ops.length ? this.formatDate(ops[0].dateOperation) : '—';
        const refC = ref.length > 8 ? ref.substring(0, 8).toUpperCase() + '…' : ref.toUpperCase();
        const lignes = ops.map((o, i) =>
          `<tr style="background:${i % 2 === 0 ? '#fffbeb' : '#fef9c3'}">
            <td style="padding:5px 8px">${this.formatDate(o.dateOperation)}</td>
            <td style="padding:5px 8px;text-align:right;font-weight:700;color:#92400e">${this.money(o.montant)}</td>
            <td style="padding:5px 8px">${o.modePaiement || 'ESPECES'}</td>
            <td style="padding:5px 8px;font-size:10px;color:#94a3b8">${o.referencePaiement || '—'}</td>
            <td style="padding:5px 8px">${o.utilisateurNom || '—'}</td>
          </tr>`
        ).join('');
        return `<div style="border:1.5px solid #f59e0b;border-radius:10px;margin-bottom:12px;overflow:hidden">
          <div style="background:#fef3c7;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <span style="font-weight:700;color:#92400e;font-size:12px">Groupe ${refC}</span>
              <span style="color:#b45309;font-size:11px;margin-left:8px">${dateRef}</span>
            </div>
            <strong style="color:#92400e">${this.money(total)}</strong>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead><tr style="background:#fde68a"><th style="padding:5px 8px;text-align:left">Date</th><th style="padding:5px 8px;text-align:right">Montant</th><th style="padding:5px 8px">Mode</th><th style="padding:5px 8px">Référence</th><th style="padding:5px 8px">Par</th></tr></thead>
            <tbody>${lignes}</tbody>
          </table>
        </div>`;
      }).join('');
      groupesSectionHtml = `
        <div class="sec-title" style="margin-top:18px">Paiements groupés (${this.paiementsGroupesDetail.size} groupe(s))</div>
        ${groupesRows}
      `;
    }

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Versements — ${credit.clientNom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:18px;font-size:12px;color:#1e293b}
.sheet{background:#fff;max-width:780px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(8,22,72,.12)}
.hdr{background:linear-gradient(135deg,#0f3460,#1a56db);color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-start}
.hdr-title{font-size:18px;font-weight:900}.hdr-sub{font-size:11px;opacity:.7;margin-top:3px}
.body{padding:18px 22px}
.kpi-row{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.kpi{flex:1;min-width:110px;background:#eff6ff;border-radius:10px;padding:11px;text-align:center}
.kpi.green{background:#f0fdf4}.kpi.red{background:#fef2f2}
.kpi-val{font-size:0.95rem;font-weight:900;color:#1a56db}
.kpi.green .kpi-val{color:#166534}.kpi.red .kpi-val{color:#dc2626}
.kpi-lbl{font-size:0.65rem;color:#64748b;margin-top:2px}
.info-tbl{width:100%;margin-bottom:14px}
.info-tbl td{padding:5px 8px;border-bottom:1px solid #f1f5f9;font-size:11px}
.info-tbl td:first-child{font-weight:700;color:#475569;width:140px}
.sec-title{font-size:9px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin:12px 0 8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#eff6ff;padding:7px 9px;text-align:left;font-weight:700;color:#1e40af;border-bottom:2px solid #bfdbfe}
td{padding:6px 9px;border-bottom:1px solid #f1f5f9}
.btn-bar{display:flex;gap:8px;justify-content:center;padding:10px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
.btn{border:none;border-radius:8px;padding:8px 18px;font-size:12px;font-weight:700;cursor:pointer}
.btn-p{background:#1a56db;color:#fff}.btn-c{background:#ef4444;color:#fff}
.ftr{background:linear-gradient(135deg,#0f3460,#1a56db);color:rgba(255,255,255,.6);text-align:center;padding:10px;font-size:10px}
@media print{.btn-bar{display:none}body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div>
      <div class="hdr-title">Historique des versements</div>
      <div class="hdr-sub">${boutiqueName} &mdash; Crédit N° ${credit.numeroVente}</div>
      <div class="hdr-sub">${credit.clientNom}${credit.clientPrenom ? ' ' + credit.clientPrenom : ''}${credit.clientTelephone ? ' · ' + credit.clientTelephone : ''}</div>
      <div style="margin-top:6px">${groupBadge}</div>
    </div>
    <img src="${qrUrl}" width="68" height="68" style="border-radius:8px;background:#fff;padding:3px" alt="QR" onerror="this.style.display='none'">
  </div>
  <div class="btn-bar">
    <button class="btn btn-p" onclick="window.print()">Imprimer / PDF</button>
    <button class="btn btn-c" onclick="document.getElementById('credits-pdf-overlay').remove()">Fermer</button>
  </div>
  <div class="body">
    <div class="sec-title">Informations du crédit</div>
    <table class="info-tbl">
      <tr><td>N° Vente</td><td>${credit.numeroVente}</td><td>Statut</td><td>${credit.estReglee ? '<span style="color:#166534;font-weight:700">✓ Réglé</span>' : '<span style="color:#d97706;font-weight:700">En cours</span>'}</td></tr>
      <tr><td>Vendeur</td><td>${credit.vendeurNom || '—'}</td><td>Réglé par</td><td>${credit.regleParNom || '—'}</td></tr>
    </table>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-val">${this.money(credit.montantTotal)}</div><div class="kpi-lbl">Montant total</div></div>
      <div class="kpi green"><div class="kpi-val">${this.money(credit.montantVerse)}</div><div class="kpi-lbl">Total versé</div></div>
      ${!credit.estReglee ? `<div class="kpi red"><div class="kpi-val">${this.money(credit.montantRestant)}</div><div class="kpi-lbl">Reste à payer</div></div>` : ''}
      <div class="kpi"><div class="kpi-val">${credit.progression ? credit.progression.toFixed(0) + '%' : '—'}</div><div class="kpi-lbl">Progression</div></div>
    </div>
    <div class="sec-title">Versements effectués (${vers.length})</div>
    <table>
      <thead><tr><th>Date</th><th style="text-align:right">Montant</th><th>Mode</th><th>Référence</th><th>Enregistré par</th><th>Motif</th><th>Type</th></tr></thead>
      <tbody>${versRows}</tbody>
      <tfoot><tr style="background:#eff6ff;font-weight:700"><td>Total versé</td><td style="text-align:right;color:#166534">${this.money(credit.montantVerse)}</td><td colspan="5"></td></tr></tfoot>
    </table>
    ${!credit.estReglee ? `<div style="margin-top:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px;text-align:center"><span style="color:#dc2626;font-weight:700">Reste à payer : ${this.money(credit.montantRestant)}</span></div>` : ''}
    ${groupesSectionHtml}
  </div>
  <div class="ftr">${boutiqueName} &middot; Historique versements &middot; ${new Date().toLocaleDateString('fr-FR')}</div>
</div></body></html>`;

    this.openLocalOverlay(html);
  }

  private buildVersementsFallbackHtml(credit: any, vers: any[]): string {
    const versRows = vers.map(v =>
      `<tr><td>${this.formatDate(v.dateOperation)}</td><td style="text-align:right;color:green;font-weight:bold">${this.money(v.montant)}</td><td>${v.modePaiement || 'ESPECES'}</td><td>${v.referencePaiement || '—'}</td></tr>`
    ).join('');
    return `<html><body style="font-family:sans-serif;padding:20px"><h2>Versements — ${credit.clientNom}</h2>
<p><strong>N° Vente :</strong> ${credit.numeroVente} | <strong>Total versé :</strong> ${this.money(credit.montantVerse)} | <strong>Reste :</strong> ${this.money(credit.montantRestant)}</p>
<table border="1" style="width:100%;border-collapse:collapse;margin-top:16px"><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Référence</th></tr>${versRows}</table>
</body></html>`;
  }

  imprimerListeCredits(): void {
    const shop = this.boutiqueService.getInfo();
    const date = new Date().toLocaleDateString('fr-FR');
    const liste = this.allCredits.filter(c => {
      if (this.statutFilter === 'EN_COURS') return !c.estReglee;
      if (this.statutFilter === 'REGLES') return !!c.estReglee;
      return true;
    });

    const totalInitial = liste.reduce((s, c) => s + c.montantTotal, 0);
    const totalVerse = liste.reduce((s, c) => s + c.montantVerse, 0);
    const totalRestant = liste.reduce((s, c) => s + c.montantRestant, 0);
    const statutLabel = this.statutFilter === 'EN_COURS' ? 'En cours' : this.statutFilter === 'REGLES' ? 'Reglés' : 'Tous';

    const qrData = encodeURIComponent('Credits ' + statutLabel + ' ' + (shop.nom || '') + ' ' + date);
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=' + qrData;

    const lignes = liste.map((c, i) =>
      '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f8fafc') + '">' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">' + c.clientNom + (c.clientPrenom ? ' ' + c.clientPrenom : '') + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">' + (c.clientTelephone || '—') + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right">' + this.money(c.montantTotal) + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;color:#16a34a">' + this.money(c.montantVerse) + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700;color:' + (c.estReglee ? '#16a34a' : '#d97706') + '">' + this.money(c.montantRestant) + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:center">' + (c.estReglee ? '<span style="color:#16a34a;font-weight:700">Regle</span>' : c.enRetard ? '<span style="color:#ef4444;font-weight:700">Retard</span>' : '<span style="color:#d97706">En cours</span>') + '</td>' +
      '</tr>'
    ).join('');

    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Credits - ' + statutLabel + '</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f4f8;padding:24px;font-size:13px;color:#1e293b}' +
      '.sheet{background:#fff;max-width:950px;margin:0 auto;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}' +
      '.hdr{background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start}' +
      '.hdr h1{font-size:22px;font-weight:900;margin-bottom:4px}.hdr p{font-size:12px;opacity:.75;margin-top:3px}' +
      '.body{padding:24px 32px}' +
      '.kpis{display:flex;gap:12px;margin-bottom:20px}' +
      '.kpi{flex:1;border-radius:10px;padding:14px 16px;text-align:center}' +
      '.kpi-lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;opacity:.75;margin-bottom:4px}' +
      '.kpi-val{font-size:18px;font-weight:900}' +
      '.kpi--blue{background:#dbeafe;color:#1d4ed8}.kpi--green{background:#dcfce7;color:#15803d}.kpi--amber{background:#fef3c7;color:#b45309}' +
      'table{width:100%;border-collapse:collapse}thead tr{background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff}' +
      'thead th{padding:9px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left;border:1px solid rgba(255,255,255,.1)}' +
      '.ftr{background:#f0fdfa;padding:14px 32px;font-size:11px;color:#115e59;text-align:center}' +
      '.btn-bar{display:flex;gap:8px;margin-bottom:16px}' +
      '.btn-print{background:#0f766e;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}' +
      '.btn-close{background:#64748b;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}' +
      '@media print{.btn-bar{display:none}body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}' +
      '</style></head><body>' +
      '<div class="sheet">' +
      '<div class="hdr"><div><h1>Credits : ' + statutLabel + '</h1><p>' + (shop.nom || 'Ges Boutique') + '</p><p>Genere le ' + date + '</p></div>' +
      '<div style="text-align:right"><img src="' + qrUrl + '" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px" alt="QR"></div></div>' +
      '<div class="body">' +
      '<div class="btn-bar"><button class="btn-print" onclick="window.print()">Imprimer / PDF</button><button class="btn-close" onclick="window.close()">Fermer</button></div>' +
      '<div class="kpis">' +
      '<div class="kpi kpi--blue"><div class="kpi-lbl">Total initial</div><div class="kpi-val">' + this.money(totalInitial) + '</div></div>' +
      '<div class="kpi kpi--green"><div class="kpi-lbl">Total verse</div><div class="kpi-val">' + this.money(totalVerse) + '</div></div>' +
      '<div class="kpi kpi--amber"><div class="kpi-lbl">Restant du</div><div class="kpi-val">' + this.money(totalRestant) + '</div></div>' +
      '</div>' +
      (liste.length ? '<table><thead><tr><th>Client</th><th>Telephone</th><th style="text-align:right">Initial</th><th style="text-align:right">Verse</th><th style="text-align:right">Restant</th><th style="text-align:center">Statut</th></tr></thead><tbody>' + lignes + '</tbody></table>' : '<p style="text-align:center;color:#64748b;padding:24px">Aucun credit</p>') +
      '</div><div class="ftr">' + (shop.nom || 'Ges Boutique') + ' · Credits ' + statutLabel + ' · ' + date + ' · ' + liste.length + ' credit(s)</div></div>' +
      '</body></html>';

    this.openLocalOverlay(html);
  }

  private openLocalOverlay(html: string): void {
    document.getElementById('credits-pdf-overlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'credits-pdf-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:rgba(0,0,0,.65)';
    const btnFloat = document.createElement('button');
    btnFloat.textContent = '✕';
    btnFloat.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:12px;background:rgba(0,0,0,.75);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:20px;font-weight:700;cursor:pointer;z-index:2;line-height:1';
    btnFloat.addEventListener('click', () => overlay.remove());
    overlay.appendChild(btnFloat);
    const frame = document.createElement('iframe');
    frame.style.cssText = 'flex:1;width:100%;border:none;background:#f0f4f8';
    frame.setAttribute('srcdoc', html);
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#0f766e;padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap';
    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fermer';
    btnClose.style.cssText = 'background:#fff;color:#0f766e;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
    btnClose.addEventListener('click', () => overlay.remove());
    const btnPrint = document.createElement('button');
    btnPrint.textContent = 'Imprimer';
    btnPrint.style.cssText = 'background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
    btnPrint.addEventListener('click', () => frame.contentWindow?.print());
    bar.appendChild(btnClose);
    bar.appendChild(btnPrint);
    overlay.appendChild(frame);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2400, position: 'top' });
    await t.present();
  }
}
