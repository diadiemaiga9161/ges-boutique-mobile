import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { TransfertService, TransfertStock, BoutiquePartenaire, TransfertRequest, PaiementTransfert } from '../../services/transfert.service';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-transferts',
  templateUrl: './transferts.page.html',
  styleUrls: ['./transferts.page.scss'],
  standalone: false
})
export class TransfertsPage implements OnInit {
  trackById = (_: number, item: any) => item.id;

  transferts: TransfertStock[] = [];
  partenaires: BoutiquePartenaire[] = [];
  produits: any[] = [];
  isLoading = false;

  ongletActif: 'tous' | 'envoyes' | 'recus' = 'tous';
  transfertsEnvoyes: TransfertStock[] = [];
  transfertsRecus: TransfertStock[] = [];
  nbEnAttente = 0;

  afficherFormulaire = false;
  editingId: number | null = null;
  form: TransfertRequest = { boutiqueDestId: 0, typePaiement: 'SANS_PAIEMENT', notes: '', lignes: [] };

  transfertDetail: TransfertStock | null = null;
  modalEditMode = false;
  modalLignes: { produitId: number; produitNom: string; quantite: number; prixUnitaire?: number }[] = [];

  produitsBoutiqueDestinee: any[] = [];
  chargementProduitsDest = false;
  paiementsTransfert: PaiementTransfert[] = [];
  afficherSectionPaiements = false;
  formPaiement = { montant: 0, modePaiement: 'ESPECES', notes: '' };

  transfertsEnAttente: TransfertStock[] = [];
  transfertEnCours: TransfertStock | null = null;
  showAccuseModal = false;
  showMotifRejet = false;
  motifRejet = '';
  actionEnCours = false;

  readonly MODES_PAIEMENT = [
    { v: 'ESPECES',      l: 'Especes' },
    { v: 'ORANGE_MONEY', l: 'Orange Money' },
    { v: 'MOOV_MONEY',   l: 'Moov Money' },
    { v: 'WAVE_MONEY',   l: 'Wave Money' },
    { v: 'VIREMENT',     l: 'Virement' }
  ];

  readonly TYPES_PAIEMENT = [
    { v: 'SANS_PAIEMENT', l: 'Sans paiement' },
    { v: 'IMMEDIAT',      l: 'Paiement immédiat' },
    { v: 'CREDIT',        l: 'Crédit' }
  ];
  readonly STATUT_LABELS: Record<string, string> = {
    CREE: 'Créé', EN_ATTENTE_CONFIRMATION: 'En attente', EN_ATTENTE: 'En attente',
    CONFIRME: 'Confirmé', ACCEPTE: 'Accepté', REJETE: 'Rejeté', COMPLETE: 'Complété', ANNULE: 'Annulé'
  };
  readonly STATUT_COLORS: Record<string, string> = {
    CREE: 'primary', EN_ATTENTE_CONFIRMATION: 'warning', EN_ATTENTE: 'warning',
    CONFIRME: 'success', ACCEPTE: 'success', REJETE: 'danger', COMPLETE: 'tertiary', ANNULE: 'medium'
  };

  constructor(
    private transfertService: TransfertService,
    private productService: ProductService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void { this.charger(); }

  ionViewWillEnter(): void { this.charger(); this.chargerOnglets(); this.verifierTransfertsEnAttente(); }

  charger(): void {
    this.isLoading = true;
    this.transfertService.getTout().subscribe({
      next: t => { this.transferts = t; this.isLoading = false; },
      error: () => this.isLoading = false
    });
    this.transfertService.getPartenaires().subscribe(p => this.partenaires = p);
    this.productService.getProducts().subscribe(p => this.produits = p);
  }

  // ==================== FORMULAIRE PRINCIPAL ====================

  nouveauTransfert(): void {
    this.editingId = null;
    this.form = { boutiqueDestId: 0, typePaiement: 'SANS_PAIEMENT', notes: '', lignes: [{ produitId: 0, produitNom: '', quantite: 1 }] };
    this.afficherFormulaire = true;
  }

  editerTransfert(t: TransfertStock): void {
    if (t.statut === 'CONFIRME' || t.statut === 'ANNULE') return;
    const dest = this.partenaires.find(p => p.nom === t.boutiqueDestNom);
    this.editingId = t.id!;
    this.form = {
      boutiqueDestId: dest?.id ?? 0,
      typePaiement: t.typePaiement,
      notes: t.notes ?? '',
      lignes: t.lignes.map(l => ({ produitId: l.produitId, produitNom: l.produitNom, quantite: l.quantite, prixUnitaire: l.prixUnitaire }))
    };
    this.afficherFormulaire = true;
  }

  ajouterLigne(): void {
    this.form.lignes.push({ produitId: 0, produitNom: '', quantite: 1 });
  }

  supprimerLigne(i: number): void {
    this.form.lignes.splice(i, 1);
  }

  onProduitChange(i: number): void {
    const p = this.produits.find(pr => pr.id === +this.form.lignes[i].produitId);
    if (p) { this.form.lignes[i].produitNom = p.nom; this.form.lignes[i].prixUnitaire = p.prixVente; }
  }

  sauvegarder(): void {
    if (!this.form.boutiqueDestId || this.form.lignes.length === 0) {
      this.toast('Sélectionnez une boutique et ajoutez un produit', 'warning'); return;
    }
    const obs$ = this.editingId
      ? this.transfertService.modifier(this.editingId, this.form)
      : this.transfertService.creer(this.form);
    obs$.subscribe({
      next: () => { this.afficherFormulaire = false; this.charger(); this.toast('Transfert enregistré', 'success'); },
      error: e => this.toast(e.error?.message ?? 'Erreur', 'danger')
    });
  }

  // ==================== ÉDITION PRODUITS DANS LE MODAL ====================

  activerEditionModal(): void {
    if (!this.transfertDetail) return;
    this.modalLignes = this.transfertDetail.lignes.map(l => ({
      produitId: l.produitId,
      produitNom: l.produitNom,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire
    }));
    this.modalEditMode = true;
  }

  annulerEditionModal(): void {
    this.modalEditMode = false;
    this.modalLignes = [];
  }

  onProduitChangeModal(i: number): void {
    const p = this.produits.find(pr => pr.id === +this.modalLignes[i].produitId);
    if (p) { this.modalLignes[i].produitNom = p.nom; this.modalLignes[i].prixUnitaire = p.prixVente; }
  }

  ajouterLigneModal(): void {
    this.modalLignes.push({ produitId: 0, produitNom: '', quantite: 1 });
  }

  supprimerLigneModal(i: number): void {
    this.modalLignes.splice(i, 1);
  }

  sauvegarderModal(): void {
    if (!this.transfertDetail) return;
    if (this.modalLignes.length === 0) {
      this.toast('Ajoutez au moins un produit', 'warning'); return;
    }
    const dest = this.partenaires.find(p => p.nom === this.transfertDetail!.boutiqueDestNom);
    const req: TransfertRequest = {
      boutiqueDestId: dest?.id ?? 0,
      typePaiement: this.transfertDetail.typePaiement,
      notes: this.transfertDetail.notes ?? '',
      lignes: this.modalLignes.map(l => ({
        produitId: +l.produitId,
        produitNom: l.produitNom,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire
      }))
    };
    this.transfertService.modifier(this.transfertDetail.id!, req).subscribe({
      next: updated => {
        this.transfertDetail = updated;
        this.modalEditMode = false;
        this.charger();
        this.toast('Produits mis à jour', 'success');
      },
      error: e => this.toast(e.error?.message ?? 'Erreur', 'danger')
    });
  }

  fermerModal(): void {
    this.transfertDetail = null;
    this.modalEditMode = false;
    this.modalLignes = [];
    this.paiementsTransfert = [];
    this.afficherSectionPaiements = false;
  }

  // ==================== CONFIRMER / ANNULER ====================

  async confirmer(t: TransfertStock): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Confirmer définitivement ?',
      message: 'Aucune modification ne sera possible après confirmation.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Confirmer', handler: () => {
          this.transfertService.confirmer(t.id!).subscribe({
            next: () => { this.charger(); this.toast('Transfert confirmé !', 'success'); },
            error: e => this.toast(e.error?.message, 'danger')
          });
        }}
      ]
    });
    await alert.present();
  }

  async annuler(t: TransfertStock): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Annuler le transfert',
      inputs: [{ name: 'motif', type: 'text', placeholder: 'Motif (optionnel)' }],
      buttons: [
        { text: 'Retour', role: 'cancel' },
        { text: 'Annuler le transfert', handler: (d) => {
          this.transfertService.annuler(t.id!, d.motif).subscribe({
            next: () => { this.charger(); this.toast('Transfert annulé', 'medium'); },
            error: e => this.toast(e.error?.message, 'danger')
          });
        }}
      ]
    });
    await alert.present();
  }

  voirDetail(t: TransfertStock): void {
    this.modalEditMode = false;
    this.afficherSectionPaiements = false;
    this.paiementsTransfert = [];
    this.transfertService.getById(t.id!).subscribe(d => {
      this.transfertDetail = d;
      this.chargerPaiements(d.id!);
    });
  }

  onBoutiqueDestChange(): void {
    if (!this.form.boutiqueDestId) { this.produitsBoutiqueDestinee = []; return; }
    this.chargementProduitsDest = true;
    this.transfertService.getProduitsBoutique(this.form.boutiqueDestId).subscribe({
      next: p => { this.produitsBoutiqueDestinee = p; this.chargementProduitsDest = false; },
      error: () => { this.produitsBoutiqueDestinee = []; this.chargementProduitsDest = false; }
    });
  }

  chargerPaiements(transfertId: number): void {
    this.transfertService.getPaiementsTransfert(transfertId).subscribe(p => this.paiementsTransfert = p);
  }

  async enregistrerPaiement(): Promise<void> {
    if (!this.transfertDetail || !this.formPaiement.montant) {
      await this.toast('Montant requis', 'warning');
      return;
    }
    this.transfertService.ajouterPaiement(this.transfertDetail.id!, this.formPaiement).subscribe({
      next: () => {
        this.afficherSectionPaiements = false;
        this.chargerPaiements(this.transfertDetail!.id!);
        this.toast('Paiement enregistre', 'success');
      },
      error: e => this.toast(e.error?.message ?? 'Erreur', 'danger')
    });
  }

  labelModePaiement(v: string): string {
    return this.MODES_PAIEMENT.find(m => m.v === v)?.l ?? v;
  }

  labelPaiement(v: string): string {
    return this.TYPES_PAIEMENT.find(tp => tp.v === v)?.l ?? v;
  }

  estEditable(t: TransfertStock | null): boolean {
    if (!t) return false;
    return t.statut !== 'CONFIRME' && t.statut !== 'ANNULE';
  }

  chargerOnglets(): void {
    this.transfertService.getEnvoyes().subscribe({
      next: t => { this.transfertsEnvoyes = t; },
      error: () => {}
    });
    this.transfertService.getRecus().subscribe({
      next: t => {
        this.transfertsRecus = t;
        this.nbEnAttente = t.filter(tr =>
          tr.statut === 'EN_ATTENTE_CONFIRMATION' || tr.statut === 'EN_ATTENTE'
        ).length;
      },
      error: () => {}
    });
  }

  changerOnglet(o: 'tous' | 'envoyes' | 'recus'): void {
    this.ongletActif = o;
    if (o !== 'tous') this.chargerOnglets();
  }

  get transfertsAffiches(): TransfertStock[] {
    if (this.ongletActif === 'envoyes') return this.transfertsEnvoyes;
    if (this.ongletActif === 'recus') return this.transfertsRecus;
    return this.transferts;
  }

  /**
   * Montant total (2026-08-16) — pour parité avec React Native
   * (TransfertsScreen.tsx montantTotal). Basé sur `transferts` (liste
   * complète "tous"), comme le compteur `transferts.length` déjà affiché
   * juste au-dessus dans le hero, et comme le fait RN. TransfertStock n'a
   * pas de champ montant propre côté backend, on somme donc
   * quantite×prixUnitaire sur toutes les lignes, comme déjà fait ligne par
   * ligne plus bas dans ce template (l.quantite * l.prixUnitaire).
   */
  get montantTotalAffiche(): number {
    return this.transferts.reduce(
      (sum, t) => sum + (t.lignes || []).reduce((s, l) => s + (l.quantite || 0) * (l.prixUnitaire || 0), 0),
      0
    );
  }

  async accepterTransfert(t: TransfertStock): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Accepter ce transfert ?',
      message: 'Les produits seront ajoutés à votre stock.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Accepter', handler: () => {
          this.transfertService.accepter(t.id!).subscribe({
            next: () => { this.charger(); this.chargerOnglets(); this.toast('Transfert accepté !', 'success'); },
            error: e => this.toast(e.error?.message ?? 'Erreur', 'danger')
          });
        }}
      ]
    });
    await alert.present();
  }

  async rejeterTransfert(t: TransfertStock): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Rejeter ce transfert',
      inputs: [{ name: 'motif', type: 'text', placeholder: 'Motif (optionnel)' }],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Rejeter', handler: (d) => {
          this.transfertService.rejeter(t.id!, d.motif).subscribe({
            next: () => { this.charger(); this.chargerOnglets(); this.toast('Transfert rejeté', 'medium'); },
            error: e => this.toast(e.error?.message ?? 'Erreur', 'danger')
          });
        }}
      ]
    });
    await alert.present();
  }

  // ==================== MODAL ACCUSÉ RÉCEPTION ====================

  verifierTransfertsEnAttente(): void {
    this.transfertService.getRecus().subscribe({
      next: (recus) => {
        this.transfertsEnAttente = recus.filter(t =>
          t.statut === 'EN_ATTENTE_CONFIRMATION' || t.statut === 'CREE'
        );
        if (this.transfertsEnAttente.length > 0 && !this.showAccuseModal) {
          this.transfertEnCours = this.transfertsEnAttente[0];
          this.showAccuseModal = true;
        }
      },
      error: () => {}
    });
  }

  accepterDepuisModal(id: number): void {
    this.actionEnCours = true;
    this.transfertService.accepter(id).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showAccuseModal = false;
        this.toast('Transfert accepté — stock mis à jour', 'success');
        this.charger();
        this.chargerOnglets();
      },
      error: (err: any) => { this.actionEnCours = false; this.toast(err?.error?.message ?? 'Erreur', 'danger'); }
    });
  }

  toggleMotifRejet(): void { this.showMotifRejet = true; }

  confirmerRejetModal(): void {
    if (!this.transfertEnCours) return;
    this.actionEnCours = true;
    this.transfertService.rejeter(this.transfertEnCours.id!, this.motifRejet).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showAccuseModal = false;
        this.showMotifRejet = false;
        this.motifRejet = '';
        this.toast('Transfert rejeté', 'medium');
        this.charger();
        this.chargerOnglets();
      },
      error: (err: any) => { this.actionEnCours = false; this.toast(err?.error?.message ?? 'Erreur', 'danger'); }
    });
  }

  private async toast(msg: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
