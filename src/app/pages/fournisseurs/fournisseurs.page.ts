import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import {
  Fournisseur,
  ProductService,
  Produit
} from '../../services/product.service';

@Component({
  selector: 'app-fournisseurs',
  templateUrl: './fournisseurs.page.html',
  styleUrls: ['./fournisseurs.page.scss'],
  standalone: false
})
export class FournisseursPage {
  segment: 'liste' | 'achats' | 'paiements' | 'situation' = 'liste';

  fournisseurs: Fournisseur[] = [];
  filteredFournisseurs: Fournisseur[] = [];
  produits: Produit[] = [];
  searchTerm = '';
  loading = false;

  selectedFournisseur?: Fournisseur;

  // Formulaire fournisseur
  showFournisseurModal = false;
  fournisseurForm = { id: 0, nom: '', code: '', adresse: '', telephone: '', email: '', description: '', actif: true };

  // Achats
  achats: any[] = [];
  loadingAchats = false;
  showAchatModal = false;
  achatForm = { fournisseurId: 0, produitId: 0, quantite: 1, prixAchatUnitaire: 0, prixVente: 0, montantPaye: 0, commentaire: '' };

  // Paiements & Avances
  paiements: any[] = [];
  avances: any[] = [];
  loadingPaiements = false;
  showPaiementModal = false;
  showAvanceModal = false;
  paiementForm = { fournisseurId: 0, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '' };
  avanceForm = { fournisseurId: 0, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '' };

  // Situation
  situation: any = null;
  soldeAvance = 0;
  loadingSituation = false;

  constructor(
    private productService: ProductService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter(): void {
    this.loadFournisseurs();
    this.productService.getProducts().subscribe(p => this.produits = p);
  }

  segmentChanged(ev: any): void {
    this.segment = ev.detail.value;
    if ((this.segment === 'achats' || this.segment === 'paiements' || this.segment === 'situation') && this.selectedFournisseur) {
      this.loadDetails(this.selectedFournisseur.id);
    }
  }

  loadFournisseurs(event?: any): void {
    this.loading = true;
    const obs = this.searchTerm.trim()
      ? this.productService.searchFournisseurs(this.searchTerm)
      : this.productService.getAllFournisseurs();
    obs.subscribe({
      next: list => {
        this.fournisseurs = list;
        this.filteredFournisseurs = list;
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

  onSearch(): void {
    this.loadFournisseurs();
  }

  selectFournisseur(f: Fournisseur): void {
    this.selectedFournisseur = f;
    this.achatForm.fournisseurId = f.id;
    this.paiementForm.fournisseurId = f.id;
    this.avanceForm.fournisseurId = f.id;
    this.loadDetails(f.id);
    this.segment = 'achats';
  }

  loadDetails(id: number): void {
    this.loadingAchats = true;
    this.loadingPaiements = true;
    this.loadingSituation = true;

    this.productService.getHistoriqueAchats(id).subscribe({
      next: a => { this.achats = a; this.loadingAchats = false; },
      error: () => { this.loadingAchats = false; }
    });
    this.productService.getHistoriquePaiements(id).subscribe({
      next: p => { this.paiements = p; this.loadingPaiements = false; },
      error: () => { this.loadingPaiements = false; }
    });
    this.productService.getHistoriqueAvancesFournisseur(id).subscribe({
      next: a => { this.avances = a; },
      error: () => {}
    });
    this.productService.getSituationFournisseur(id).subscribe({
      next: s => { this.situation = s; this.loadingSituation = false; },
      error: () => { this.loadingSituation = false; }
    });
    this.productService.getSoldeAvanceFournisseur(id).subscribe({
      next: s => { this.soldeAvance = s; },
      error: () => {}
    });
  }

  // ======= Fournisseur CRUD =======

  openNewFournisseur(): void {
    this.fournisseurForm = { id: 0, nom: '', code: '', adresse: '', telephone: '', email: '', description: '', actif: true };
    this.showFournisseurModal = true;
  }

  editFournisseur(f: Fournisseur): void {
    this.fournisseurForm = { id: f.id, nom: f.nom, code: f.code || '', adresse: f.adresse || '', telephone: f.telephone || '', email: f.email || '', description: f.description || '', actif: f.actif !== false };
    this.showFournisseurModal = true;
  }

  saveFournisseur(): void {
    if (!this.fournisseurForm.nom.trim()) { this.toast('Le nom est obligatoire', 'danger'); return; }
    if (!this.fournisseurForm.code.trim()) { this.toast('Le code est obligatoire (ex: FOUR-001)', 'danger'); return; }
    const { id, ...payload } = this.fournisseurForm;
    const req = id ? this.productService.updateFournisseur(id, payload) : this.productService.createFournisseur(payload);
    req.subscribe({
      next: () => {
        this.toast('Fournisseur enregistré ✓');
        this.showFournisseurModal = false;
        this.loadFournisseurs();
      },
      error: err => this.toast(err?.error?.message || 'Enregistrement impossible', 'danger')
    });
  }

  async deleteFournisseur(f: Fournisseur): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer le fournisseur',
      message: `<strong>${f.nom}</strong> sera supprimé définitivement.`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', cssClass: 'alert-btn-danger',
          handler: () => this.productService.deleteFournisseur(f.id).subscribe({
            next: () => { this.toast('Fournisseur supprimé'); this.loadFournisseurs(); },
            error: e => this.toast(e.message || 'Suppression impossible', 'danger')
          })
        }
      ]
    });
    await alert.present();
  }

  // ======= Achat =======

  openAchat(): void {
    if (!this.selectedFournisseur) { this.toast('Sélectionnez un fournisseur d\'abord', 'danger'); return; }
    this.achatForm = { fournisseurId: this.selectedFournisseur.id, produitId: 0, quantite: 1, prixAchatUnitaire: 0, prixVente: 0, montantPaye: 0, commentaire: '' };
    this.showAchatModal = true;
  }

  saveAchat(): void {
    if (!this.achatForm.produitId) { this.toast('Sélectionnez un produit', 'danger'); return; }
    if (!this.achatForm.quantite || this.achatForm.quantite <= 0) { this.toast('Quantité invalide', 'danger'); return; }
    if (!this.achatForm.prixAchatUnitaire || this.achatForm.prixAchatUnitaire <= 0) { this.toast('Prix achat invalide', 'danger'); return; }

    this.productService.creerAchat({
      fournisseurId: this.achatForm.fournisseurId,
      lignes: [{ produitId: this.achatForm.produitId, quantite: this.achatForm.quantite, prixAchatUnitaire: this.achatForm.prixAchatUnitaire, prixVente: this.achatForm.prixVente }],
      montantPaye: this.achatForm.montantPaye,
      utilisateurId: this.auth.getUserId()
    }).subscribe({
      next: () => {
        this.toast('Achat enregistré ✓');
        this.showAchatModal = false;
        this.loadDetails(this.achatForm.fournisseurId);
      },
      error: err => this.toast(err?.error?.message || 'Achat impossible', 'danger')
    });
  }

  // ======= Paiement =======

  openPaiement(): void {
    if (!this.selectedFournisseur) { this.toast('Sélectionnez un fournisseur d\'abord', 'danger'); return; }
    this.paiementForm = { fournisseurId: this.selectedFournisseur.id, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '' };
    this.showPaiementModal = true;
  }

  savePaiement(): void {
    if (!this.paiementForm.montant || this.paiementForm.montant <= 0) { this.toast('Montant invalide', 'danger'); return; }
    this.productService.payerFournisseur({ ...this.paiementForm, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => {
        this.toast('Paiement enregistré ✓');
        this.showPaiementModal = false;
        this.loadDetails(this.paiementForm.fournisseurId);
      },
      error: err => this.toast(err?.error?.message || 'Paiement impossible', 'danger')
    });
  }

  // ======= Avance =======

  openAvance(): void {
    if (!this.selectedFournisseur) { this.toast('Sélectionnez un fournisseur d\'abord', 'danger'); return; }
    this.avanceForm = { fournisseurId: this.selectedFournisseur.id, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '' };
    this.showAvanceModal = true;
  }

  saveAvance(): void {
    if (!this.avanceForm.montant || this.avanceForm.montant <= 0) { this.toast('Montant invalide', 'danger'); return; }
    this.productService.enregistrerAvanceFournisseur({ ...this.avanceForm, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => {
        this.toast('Avance enregistrée ✓');
        this.showAvanceModal = false;
        this.loadDetails(this.avanceForm.fournisseurId);
      },
      error: err => this.toast(err?.error?.message || 'Avance impossible', 'danger')
    });
  }

  // ======= Utilitaires =======

  getInitiale(nom: string): string {
    return (nom || '?')[0].toUpperCase();
  }

  money(v: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(v || 0));
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
