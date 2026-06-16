import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { TransfertService, TransfertStock, BoutiquePartenaire, TransfertRequest } from '../../services/transfert.service';
import { ProductService } from '../../services/product.service';

@Component({
  selector: 'app-transferts',
  templateUrl: './transferts.page.html',
  styleUrls: ['./transferts.page.scss'],
  standalone: false
})
export class TransfertsPage implements OnInit {

  transferts: TransfertStock[] = [];
  partenaires: BoutiquePartenaire[] = [];
  produits: any[] = [];
  isLoading = false;

  afficherFormulaire = false;
  editingId: number | null = null;
  form: TransfertRequest = { boutiqueDestId: 0, typePaiement: 'SANS_PAIEMENT', notes: '', lignes: [] };

  transfertDetail: TransfertStock | null = null;
  modalEditMode = false;
  modalLignes: { produitId: number; produitNom: string; quantite: number; prixUnitaire?: number }[] = [];

  readonly TYPES_PAIEMENT = [
    { v: 'SANS_PAIEMENT', l: 'Sans paiement' },
    { v: 'IMMEDIAT',      l: 'Paiement immédiat' },
    { v: 'CREDIT',        l: 'Crédit' }
  ];
  readonly STATUT_LABELS: Record<string, string> = {
    CREE: 'Créé', EN_ATTENTE_CONFIRMATION: 'En attente', CONFIRME: 'Confirmé', ANNULE: 'Annulé'
  };
  readonly STATUT_COLORS: Record<string, string> = {
    CREE: 'primary', EN_ATTENTE_CONFIRMATION: 'warning', CONFIRME: 'success', ANNULE: 'medium'
  };

  constructor(
    private transfertService: TransfertService,
    private productService: ProductService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void { this.charger(); }

  ionViewWillEnter(): void { this.charger(); }

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
    this.transfertService.getById(t.id!).subscribe(d => this.transfertDetail = d);
  }

  labelPaiement(v: string): string {
    return this.TYPES_PAIEMENT.find(tp => tp.v === v)?.l ?? v;
  }

  estEditable(t: TransfertStock | null): boolean {
    if (!t) return false;
    return t.statut !== 'CONFIRME' && t.statut !== 'ANNULE';
  }

  private async toast(msg: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
