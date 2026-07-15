import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { CommandeService, Commande, CommandeRequest, StatutCommande } from '../../services/commande.service';
import { ProductService, Produit } from '../../services/product.service';
import { Client, ClientService } from '../../services/client.service';
import { AuthService } from '../../services/auth.service';

interface LigneForm {
  produitId: number;
  produitNom: string;
  prixOriginal: number;
  prixUnitaire: number;
  quantite: number;
  remise: number;
}

@Component({
  selector: 'app-commandes',
  templateUrl: './commandes.page.html',
  styleUrls: ['./commandes.page.scss'],
  standalone: false
})
export class CommandesPage {
  commandes: Commande[] = [];
  commandesFiltrees: Commande[] = [];
  produits: Produit[] = [];
  clients: Client[] = [];
  isLoading = false;

  statutFilter: '' | 'BROUILLON' | 'VALIDEE' | 'CREDIT' | 'ANNULEE' = '';
  searchTerm = '';

  // Modal formulaire
  showModal = false;
  editingId: number | null = null;
  lignesForm: LigneForm[] = [];

  searchProduit = '';
  produitsFiltres: Produit[] = [];
  showProduitDropdown = false;
  searchClient = '';
  clientsFiltres: Client[] = [];
  showClientDropdown = false;

  form = {
    clientId: null as number | null,
    clientNom: '',
    clientPrenom: '',
    clientTelephone: '',
    modePaiement: 'ESPECES',
    referencePaiement: '',
    estCredit: false,
    montantVerse: 0,
    dateEcheance: '',
    notes: ''
  };

  isSubmitting = false;
  StatutCommande = StatutCommande;
  trackById = (_: number, item: any) => item.id;

  // Modal règlement individuel
  showReglementModal = false;
  commandeSelectionnee: Commande | null = null;
  montantReglement = 0;

  // Modal règlement groupé
  showReglementGroupeModal = false;
  commandesCredit: Commande[] = [];
  idsSelectionnes: number[] = [];
  montantReglementGroupe = 0;

  constructor(
    private commandeService: CommandeService,
    private productService: ProductService,
    private clientService: ClientService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.charger();
    this.productService.getProducts().subscribe(p => {
      this.produits = p.filter((x: Produit) => x.quantite > 0);
    });
    this.clientService.getAll().subscribe((c: any) => {
      this.clients = c.content || c || [];
    });
  }

  charger(event?: any): void {
    this.isLoading = true;
    this.commandeService.getAll().subscribe({
      next: data => {
        this.commandes = data;
        this.appliquerFiltres();
        this.isLoading = false;
        event?.target?.complete();
      },
      error: () => {
        this.isLoading = false;
        event?.target?.complete();
      }
    });
  }

  appliquerFiltres(): void {
    let liste = [...this.commandes];
    if (this.statutFilter === 'CREDIT') {
      liste = liste.filter(c => c.estCredit && c.montantRestant > 0);
    } else if (this.statutFilter === 'ANNULEE') {
      liste = liste.filter((c: any) => c.statut === 'ANNULEE');
    } else if (this.statutFilter) {
      liste = liste.filter(c => c.statut === this.statutFilter);
    }
    if (this.searchTerm.trim()) {
      const t = this.searchTerm.toLowerCase();
      liste = liste.filter(c =>
        c.numeroCommande?.toLowerCase().includes(t) ||
        (c.clientNom || '').toLowerCase().includes(t) ||
        (c.notes || '').toLowerCase().includes(t)
      );
    }
    this.commandesFiltrees = liste;
  }

  // ─── Produit search ────────────────────────────────────────────────────────

  filtrerProduits(): void {
    const t = this.searchProduit.toLowerCase().trim();
    this.produitsFiltres = t
      ? this.produits.filter(p => p.nom.toLowerCase().includes(t)).slice(0, 8)
      : this.produits.slice(0, 8);
    this.showProduitDropdown = true;
  }

  selectionnerProduit(p: Produit): void {
    const existing = this.lignesForm.find(l => l.produitId === p.id);
    if (existing) { existing.quantite = existing.quantite + 1; }
    else { this.lignesForm.push({ produitId: p.id, produitNom: p.nom, prixOriginal: p.prixVente, prixUnitaire: p.prixVente, quantite: 1, remise: 0 }); }
    this.searchProduit = '';
    this.showProduitDropdown = false;
  }

  supprimerLigne(i: number): void {
    this.lignesForm.splice(i, 1);
  }

  changerQuantite(ligne: LigneForm, delta: number): void {
    const nv = ligne.quantite + delta;
    if (nv >= 1) ligne.quantite = nv;
  }

  // ─── Client search ─────────────────────────────────────────────────────────

  filtrerClients(): void {
    const t = this.searchClient.toLowerCase().trim();
    this.clientsFiltres = t
      ? this.clients.filter((c: any) => `${c.nom} ${c.prenom} ${c.numeroTelephone}`.toLowerCase().includes(t)).slice(0, 6)
      : this.clients.slice(0, 6);
    this.showClientDropdown = true;
  }

  selectionnerClient(c: any): void {
    this.form.clientId = c.id;
    this.form.clientNom = c.nom;
    this.form.clientPrenom = c.prenom || '';
    this.form.clientTelephone = c.numeroTelephone || '';
    this.searchClient = `${c.nom} ${c.prenom || ''}`.trim();
    this.showClientDropdown = false;
  }

  effacerClient(): void {
    this.form.clientId = null;
    this.form.clientNom = '';
    this.form.clientPrenom = '';
    this.form.clientTelephone = '';
    this.searchClient = '';
  }

  // ─── Calculs ───────────────────────────────────────────────────────────────

  prixLigne(l: LigneForm): number {
    return l.prixUnitaire * l.quantite * (1 - (l.remise || 0) / 100);
  }

  get totalCommande(): number {
    return this.lignesForm.reduce((s, l) => s + this.prixLigne(l), 0);
  }

  get resteAPayer(): number {
    return Math.max(0, this.totalCommande - (this.form.montantVerse || 0));
  }

  // ─── Modal CRUD ────────────────────────────────────────────────────────────

  ouvrirCreer(): void {
    this.editingId = null;
    this.lignesForm = [];
    this.form = { clientId: null, clientNom: '', clientPrenom: '', clientTelephone: '', modePaiement: 'ESPECES', referencePaiement: '', estCredit: false, montantVerse: 0, dateEcheance: '', notes: '' };
    this.searchClient = '';
    this.searchProduit = '';
    this.showModal = true;
  }

  ouvrirModifier(commande: Commande): void {
    this.editingId = commande.id;
    this.form = {
      clientId: commande.client?.id || null,
      clientNom: commande.clientNom || '',
      clientPrenom: commande.clientPrenom || '',
      clientTelephone: commande.clientTelephone || '',
      modePaiement: commande.modePaiement || 'ESPECES',
      referencePaiement: commande.referencePaiement || '',
      estCredit: commande.estCredit || false,
      montantVerse: commande.montantVerse || 0,
      dateEcheance: commande.dateEcheance ? commande.dateEcheance.split('T')[0] : '',
      notes: commande.notes || ''
    };
    this.searchClient = [commande.clientNom, commande.clientPrenom].filter(Boolean).join(' ');
    this.lignesForm = (commande.lignes || []).map(l => ({
      produitId: l.produit?.id || l.produitId || 0,
      produitNom: l.produit?.nom || l.produitNom || '',
      prixOriginal: l.produit?.prixVente || l.prixUnitaire,
      prixUnitaire: l.prixUnitaire,
      quantite: l.quantite,
      remise: (l as any).remise || 0
    }));
    this.showModal = true;
  }

  fermerModal(): void {
    this.showModal = false;
    this.editingId = null;
    this.showProduitDropdown = false;
    this.showClientDropdown = false;
  }

  async enregistrer(): Promise<void> {
    if (this.lignesForm.length === 0) {
      return this.toast('Ajoutez au moins un produit', 'warning');
    }
    if (this.form.modePaiement !== 'ESPECES' && !this.form.referencePaiement?.trim()) {
      return this.toast('La référence de paiement est obligatoire pour ce mode', 'warning');
    }

    const request: CommandeRequest = {
      vendeurId: this.auth.getUserId(),
      clientId: this.form.clientId || undefined,
      clientNom: this.form.clientNom || undefined,
      clientPrenom: this.form.clientPrenom || undefined,
      clientTelephone: this.form.clientTelephone || undefined,
      lignes: this.lignesForm.map(l => ({
        produitId: l.produitId,
        quantite: l.quantite,
        prixUnitaire: l.remise ? Math.round(l.prixUnitaire * (1 - l.remise / 100)) : l.prixUnitaire
      })),
      modePaiement: this.form.modePaiement,
      referencePaiement: this.form.referencePaiement || undefined,
      estCredit: this.form.estCredit,
      montantVerse: this.form.estCredit ? this.form.montantVerse : undefined,
      dateEcheance: this.form.estCredit && this.form.dateEcheance ? this.form.dateEcheance : undefined,
      notes: this.form.notes || undefined
    };

    this.isSubmitting = true;
    const obs = this.editingId
      ? this.commandeService.modifier(this.editingId, request)
      : this.commandeService.creer(request);

    obs.subscribe({
      next: () => {
        this.isSubmitting = false;
        this.fermerModal();
        this.charger();
        this.toast(this.editingId ? 'Commande modifiée' : 'Commande créée', 'success');
      },
      error: (e: any) => {
        this.isSubmitting = false;
        this.toast(e.error?.message || 'Erreur lors de l\'enregistrement', 'danger');
      }
    });
  }

  // ─── Valider ───────────────────────────────────────────────────────────────

  async valider(commande: Commande): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Valider la commande ?',
      message: `${commande.numeroCommande} sera convertie en vente. Le stock sera décrémenté.`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Valider',
          handler: () => {
            this.commandeService.valider(commande.id).subscribe({
              next: () => { this.charger(); this.toast('Commande validée ! Stock mis à jour.', 'success'); },
              error: (e: any) => this.toast(e.error?.message || 'Erreur validation', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── Annuler ───────────────────────────────────────────────────────────────

  async annuler(commande: Commande): Promise<void> {
    const isValidee = commande.statut === StatutCommande.VALIDEE;
    const alert = await this.alertCtrl.create({
      header: 'Annuler la commande ?',
      message: isValidee
        ? `${commande.numeroCommande} est validée — la vente liée sera annulée et le stock restauré.`
        : `Annuler la commande ${commande.numeroCommande} ?`,
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui, annuler',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.commandeService.annuler(commande.id, this.auth.getUserId()).subscribe({
              next: () => {
                this.statutFilter = '';
                this.charger();
                this.toast(`${commande.numeroCommande} annulée avec succès`, 'success');
              },
              error: (e: any) => this.toast(e.error?.message || 'Erreur lors de l\'annulation', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── Supprimer ─────────────────────────────────────────────────────────────

  async supprimer(commande: Commande): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer définitivement ?',
      message: `Supprimer la commande ${commande.numeroCommande} ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer',
          cssClass: 'alert-button-danger',
          handler: () => {
            this.commandeService.supprimer(commande.id).subscribe({
              next: () => { this.charger(); this.toast('Commande supprimée', 'success'); },
              error: (e: any) => this.toast(e.error?.message || 'Impossible de supprimer', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ─── Facture ───────────────────────────────────────────────────────────────

  imprimerFacture(commande: Commande): void {
    this.commandeService.imprimerBonCommande(commande);
  }

  // ─── Règlement individuel ──────────────────────────────────────────────────

  ouvrirReglementIndividuel(commande: Commande): void {
    this.commandeSelectionnee = commande;
    this.montantReglement = commande.montantRestant;
    this.showReglementModal = true;
  }

  fermerReglementModal(): void {
    this.showReglementModal = false;
    this.commandeSelectionnee = null;
    this.montantReglement = 0;
  }

  confirmerReglementIndividuel(): void {
    if (!this.commandeSelectionnee || this.montantReglement <= 0) return;
    this.commandeService.payerCredit(this.commandeSelectionnee.id, this.montantReglement).subscribe({
      next: () => {
        this.fermerReglementModal();
        this.charger();
        this.toast('Paiement enregistré', 'success');
      },
      error: (e: any) => this.toast(e.error?.message || 'Erreur règlement', 'danger')
    });
  }

  // ─── Règlement groupé ──────────────────────────────────────────────────────

  ouvrirReglementGroupe(): void {
    this.commandesCredit = this.commandes.filter(c => c.estCredit && c.montantRestant > 0);
    this.idsSelectionnes = this.commandesCredit.map(c => c.id);
    this.montantReglementGroupe = this.totalCreditsRestants;
    this.showReglementGroupeModal = true;
  }

  fermerReglementGroupeModal(): void {
    this.showReglementGroupeModal = false;
    this.idsSelectionnes = [];
    this.montantReglementGroupe = 0;
  }

  toggleSelectionCredit(id: number): void {
    const idx = this.idsSelectionnes.indexOf(id);
    if (idx >= 0) this.idsSelectionnes.splice(idx, 1);
    else this.idsSelectionnes.push(id);
  }

  selectionnerTousCredits(): void {
    if (this.idsSelectionnes.length === this.commandesCredit.length) {
      this.idsSelectionnes = [];
    } else {
      this.idsSelectionnes = this.commandesCredit.map(c => c.id);
    }
  }

  confirmerReglementGroupe(): void {
    if (this.idsSelectionnes.length === 0 || this.montantReglementGroupe <= 0) return;
    this.commandeService.payerCreditsGroupes(this.idsSelectionnes, this.montantReglementGroupe).subscribe({
      next: () => {
        this.fermerReglementGroupeModal();
        this.charger();
        this.toast('Règlement groupé enregistré', 'success');
      },
      error: (e: any) => this.toast(e.error?.message || 'Erreur règlement groupé', 'danger')
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  formatMontant(v: number): string { return this.commandeService.formatMontant(v); }
  formatDate(d: string): string { return this.commandeService.formatDate(d); }
  getClientNom(c: Commande): string { return this.commandeService.getClientNom(c); }

  getModePaiementLabel(mode: string): string {
    const labels: Record<string, string> = {
      'ESPECES': 'Espèces', 'ORANGE_MONEY': 'Orange Money', 'MOOV_MONEY': 'Moov Money',
      'WAVE_MONEY': 'Wave', 'CARTE_BANCAIRE': 'Carte Bancaire', 'VIREMENT': 'Virement', 'CHEQUE': 'Chèque'
    };
    return labels[mode] || mode;
  }

  get nbBrouillons(): number { return this.commandes.filter(c => c.statut === StatutCommande.BROUILLON).length; }
  get nbValidees(): number { return this.commandes.filter(c => c.statut === StatutCommande.VALIDEE).length; }
  get totalValidees(): number { return this.commandes.filter(c => c.statut === StatutCommande.VALIDEE).reduce((s, c) => s + (c.montantTotal || 0), 0); }
  get nbCreditsEnCours(): number { return this.commandes.filter(c => c.estCredit && c.montantRestant > 0).length; }
  get totalCreditsRestants(): number { return this.commandes.filter(c => c.estCredit && c.montantRestant > 0).reduce((s, c) => s + (c.montantRestant || 0), 0); }

  private async toast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await t.present();
  }
}
