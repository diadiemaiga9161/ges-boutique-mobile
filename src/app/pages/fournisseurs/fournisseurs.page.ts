import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import {
  Fournisseur,
  ProductService,
  Produit
} from '../../services/product.service';
import { FactureService } from '../../services/facture.service';
import { BoutiqueService } from '../../services/boutique.service';
import { CompteService, Compte } from '../../services/compte.service';

@Component({
  selector: 'app-fournisseurs',
  templateUrl: './fournisseurs.page.html',
  styleUrls: ['./fournisseurs.page.scss'],
  standalone: false
})
export class FournisseursPage {
  segment: 'liste' | 'achats' | 'paiements' | 'situation' = 'liste';
  trackById = (_: number, item: any) => item.id;

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

  // Expand achat (toggle lignes produits)
  achatExpandiId: number | null = null;

  // Paiements & Avances
  paiements: any[] = [];
  avances: any[] = [];
  loadingPaiements = false;
  loadingAvances = false;
  showPaiementModal = false;
  showAvanceModal = false;
  comptes: Compte[] = [];
  paiementForm: { fournisseurId: number; montant: number; modePaiement: string; reference: string; observation: string; compteId?: number; achatCibleId?: number } =
    { fournisseurId: 0, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '', compteId: undefined, achatCibleId: undefined };
  avanceForm: { fournisseurId: number; montant: number; sourceFinancement: string; reference: string; observation: string; compteId?: number } =
    { fournisseurId: 0, montant: 0, sourceFinancement: 'CAISSE', reference: '', observation: '', compteId: undefined };

  // Situation
  situation: any = null;
  soldeAvance = 0;
  loadingSituation = false;

  // Achats non payés (statut EN_COURS, plus ancien au plus récent)
  achatsNonPayes: any[] = [];
  loadingAchatsNonPayes = false;

  // Filtre par période (Achats / Paiements / Situation)
  periodePreset: 'jour' | 'semaine' | 'mois' | 'personnalise' | 'tout' = 'tout';
  filtreDateDebut = '';
  filtreDateFin = '';

  constructor(
    private productService: ProductService,
    private auth: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private factureService: FactureService,
    private boutiqueService: BoutiqueService,
    private compteService: CompteService
  ) {}

  ionViewWillEnter(): void {
    this.loadFournisseurs();
    this.productService.getProducts().subscribe(p => this.produits = p);
    this.compteService.getTousLesComptes().subscribe({
      next: data => this.comptes = data,
      error: () => this.comptes = []
    });
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
    this.periodePreset = 'tout';
    this.filtreDateDebut = '';
    this.filtreDateFin = '';
    this.loadDetails(f.id);
    this.segment = 'achats';
  }

  loadDetails(id: number): void {
    this.loadingAchats = true;
    this.loadingPaiements = true;
    this.loadingAvances = true;
    this.loadingSituation = true;
    this.loadingAchatsNonPayes = true;

    const filtreActif = this.periodePreset !== 'tout' && !!this.filtreDateDebut && !!this.filtreDateFin;
    const dd = filtreActif ? this.filtreDateDebut : undefined;
    const df = filtreActif ? this.filtreDateFin : undefined;

    this.productService.getHistoriqueAchats(id, dd, df).subscribe({
      next: a => { this.achats = a; this.loadingAchats = false; },
      error: () => { this.loadingAchats = false; }
    });
    // Fix : paiements et avances ont chacun leur propre flag de loading
    this.productService.getHistoriquePaiements(id, dd, df).subscribe({
      next: p => { this.paiements = p; this.loadingPaiements = false; },
      error: () => { this.loadingPaiements = false; }
    });
    this.productService.getHistoriqueAvancesFournisseur(id).subscribe({
      next: a => { this.avances = a; this.loadingAvances = false; },
      error: () => { this.loadingAvances = false; }
    });
    this.productService.getSituationFournisseur(id, dd, df).subscribe({
      next: s => { this.situation = s; this.loadingSituation = false; },
      error: () => { this.loadingSituation = false; }
    });
    this.productService.getSoldeAvanceFournisseur(id).subscribe({
      next: s => { this.soldeAvance = s; },
      error: () => {}
    });
    // Pas de filtre de période pour les achats non payés (toujours l'historique complet EN_COURS)
    this.productService.getAchatsNonPayes(id).subscribe({
      next: a => { this.achatsNonPayes = a; this.loadingAchatsNonPayes = false; },
      error: () => { this.loadingAchatsNonPayes = false; }
    });
  }

  // ======= Filtre par période =======

  /** Applique un préréglage de période (jour/semaine/mois/tout) et recharge les données du fournisseur sélectionné. */
  appliquerPreset(preset: 'jour' | 'semaine' | 'mois' | 'personnalise' | 'tout'): void {
    this.periodePreset = preset;
    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();

    if (preset === 'jour') {
      this.filtreDateDebut = toIso(today);
      this.filtreDateFin = toIso(today);
    } else if (preset === 'semaine') {
      const debut = new Date(today);
      debut.setDate(debut.getDate() - 6);
      this.filtreDateDebut = toIso(debut);
      this.filtreDateFin = toIso(today);
    } else if (preset === 'mois') {
      const debut = new Date(today.getFullYear(), today.getMonth(), 1);
      this.filtreDateDebut = toIso(debut);
      this.filtreDateFin = toIso(today);
    } else if (preset === 'tout') {
      this.filtreDateDebut = '';
      this.filtreDateFin = '';
    }
    // 'personnalise' : les dates sont saisies manuellement, rien à calculer ici

    if (this.selectedFournisseur && preset !== 'personnalise') {
      this.loadDetails(this.selectedFournisseur.id);
    }
  }

  /** Valide et applique les dates saisies manuellement en mode personnalisé. */
  appliquerPeriodePersonnalisee(): void {
    if (!this.filtreDateDebut || !this.filtreDateFin) {
      this.toast('Sélectionnez une date de début et de fin', 'warning');
      return;
    }
    if (this.filtreDateDebut > this.filtreDateFin) {
      this.toast('La date de début doit précéder la date de fin', 'warning');
      return;
    }
    this.periodePreset = 'personnalise';
    if (this.selectedFournisseur) this.loadDetails(this.selectedFournisseur.id);
  }

  // ======= Toggle lignes achat =======

  toggleAchat(id: number): void {
    this.achatExpandiId = this.achatExpandiId === id ? null : id;
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
        this.toast('Fournisseur enregistré');
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

  async saveAchat(): Promise<void> {
    if (!this.achatForm.produitId) { this.toast('Sélectionnez un produit', 'danger'); return; }
    if (!this.achatForm.quantite || this.achatForm.quantite <= 0) { this.toast('Quantité invalide', 'danger'); return; }
    if (!this.achatForm.prixAchatUnitaire || this.achatForm.prixAchatUnitaire <= 0) { this.toast('Prix achat invalide', 'danger'); return; }

    // Produit existant (sélectionné dans le catalogue, pas de création à la volée dans ce formulaire)
    const produit = this.produits.find(p => p.id === this.achatForm.produitId);
    let nouveauPrixVente: number | undefined;

    if (produit && Number(produit.prixAchat) !== Number(this.achatForm.prixAchatUnitaire)) {
      const stockActuel = Number(produit.quantite) || 0;
      const quantiteEntree = Number(this.achatForm.quantite);
      const prixEntree = Number(this.achatForm.prixAchatUnitaire);
      const cump = stockActuel > 0
        ? (stockActuel * Number(produit.prixAchat) + quantiteEntree * prixEntree) / (stockActuel + quantiteEntree)
        : prixEntree;

      const confirme = await this.confirmerCump(produit, stockActuel, quantiteEntree, prixEntree, cump);
      if (confirme) {
        nouveauPrixVente = Math.round(cump);
      }
    }

    const ligne: any = { produitId: this.achatForm.produitId, quantite: this.achatForm.quantite, prixAchatUnitaire: this.achatForm.prixAchatUnitaire, prixVente: this.achatForm.prixVente };
    if (nouveauPrixVente !== undefined) {
      ligne.nouveauPrixVente = nouveauPrixVente;
    }

    this.productService.creerAchat({
      fournisseurId: this.achatForm.fournisseurId,
      lignes: [ligne],
      montantPaye: this.achatForm.montantPaye,
      utilisateurId: this.auth.getUserId()
    }).subscribe({
      next: () => {
        this.toast('Achat enregistré');
        this.showAchatModal = false;
        this.loadDetails(this.achatForm.fournisseurId);
      },
      error: err => this.toast(err?.error?.message || 'Achat impossible', 'danger')
    });
  }

  /**
   * Affiche un popup de confirmation pour le recalcul du prix de vente via le CUMP (coût moyen pondéré)
   * quand le prix d'achat saisi pour un produit existant diffère du prix d'achat actuel du produit.
   * Retourne true si l'utilisateur confirme l'application du nouveau prix, false sinon (l'achat continue quand même).
   */
  private confirmerCump(produit: Produit, stockActuel: number, quantiteEntree: number, prixEntree: number, cump: number): Promise<boolean> {
    const ancienPrix = Number(produit.prixAchat) || 0;
    const escapeHtml = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const message =
      `<strong>${escapeHtml(produit.nom)}</strong><br>` +
      `Le prix d'achat saisi (${this.money(prixEntree)}) diffère du prix d'achat actuel (${this.money(ancienPrix)}).<br><br>` +
      `Stock actuel : ${stockActuel} × ${this.money(ancienPrix)} = ${this.money(stockActuel * ancienPrix)}<br>` +
      `Entrée : ${quantiteEntree} × ${this.money(prixEntree)} = ${this.money(quantiteEntree * prixEntree)}<br><br>` +
      `CUMP = (Stock × Ancien prix + Qté entrée × Prix entrée) / (Stock + Qté entrée)<br><br>` +
      `Nouveau prix de vente proposé : <strong>${this.money(cump)}</strong><br><br>` +
      `Appliquer ce nouveau prix de vente au produit ?`;

    return new Promise<boolean>(resolve => {
      this.alertCtrl.create({
        header: 'Recalcul du prix de vente (CUMP)',
        message,
        backdropDismiss: false,
        buttons: [
          { text: 'Non, garder le prix actuel', role: 'cancel', handler: () => resolve(false) },
          { text: 'Oui, appliquer', cssClass: 'alert-btn-primary', handler: () => resolve(true) }
        ]
      }).then(alert => alert.present());
    });
  }

  async annulerAchat(achat: any): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Annuler l\'achat',
      message: `Annuler l'achat #${achat.id} ? Le stock sera restauré automatiquement.`,
      buttons: [
        { text: 'Non', role: 'cancel' },
        {
          text: 'Oui, annuler',
          cssClass: 'alert-btn-danger',
          handler: () => {
            this.productService.annulerAchatFournisseur(achat.id, this.auth.getUserId()).subscribe({
              next: () => {
                this.toast('Achat annulé — stock restauré');
                if (this.selectedFournisseur) this.loadDetails(this.selectedFournisseur.id);
              },
              error: err => this.toast(err?.error?.message || 'Annulation impossible', 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  get achatsActifs(): any[] {
    return this.achats.filter(a => a.statut !== 'ANNULE');
  }

  get achatsAnnules(): any[] {
    return this.achats.filter(a => a.statut === 'ANNULE');
  }

  // ======= Paiement =======

  openPaiement(): void {
    if (!this.selectedFournisseur) { this.toast('Sélectionnez un fournisseur d\'abord', 'danger'); return; }
    this.paiementForm = { fournisseurId: this.selectedFournisseur.id, montant: 0, modePaiement: 'ESPECES', reference: '', observation: '', compteId: undefined, achatCibleId: undefined };
    this.showPaiementModal = true;
  }

  /** Ouvre le modal de paiement pré-rempli pour solder un achat non payé précis. */
  openPaiementPourAchat(achat: any): void {
    if (!this.selectedFournisseur) { this.toast('Sélectionnez un fournisseur d\'abord', 'danger'); return; }
    this.paiementForm = {
      fournisseurId: this.selectedFournisseur.id,
      montant: achat.montantRestant || 0,
      modePaiement: 'ESPECES',
      reference: '',
      observation: `Paiement achat #${achat.id}`,
      compteId: undefined,
      achatCibleId: achat.id
    };
    this.showPaiementModal = true;
  }

  savePaiement(): void {
    if (!this.paiementForm.montant || this.paiementForm.montant <= 0) { this.toast('Montant invalide', 'danger'); return; }
    if (this.paiementForm.modePaiement === 'BANQUE' && !this.paiementForm.compteId) {
      this.toast('Choisissez un compte bancaire', 'warning'); return;
    }
    this.productService.payerFournisseur({ ...this.paiementForm, utilisateurId: this.auth.getUserId() }).subscribe({
      next: () => {
        this.toast('Paiement enregistré');
        this.showPaiementModal = false;
        this.loadDetails(this.paiementForm.fournisseurId);
      },
      error: err => this.toast(err?.error?.message || 'Paiement impossible', 'danger')
    });
  }

  // ======= Avance =======

  openAvance(): void {
    if (!this.selectedFournisseur) { this.toast('Sélectionnez un fournisseur d\'abord', 'danger'); return; }
    this.avanceForm = { fournisseurId: this.selectedFournisseur.id, montant: 0, sourceFinancement: 'CAISSE', reference: '', observation: '', compteId: undefined };
    this.showAvanceModal = true;
  }

  saveAvance(): void {
    if (!this.avanceForm.montant || this.avanceForm.montant <= 0) { this.toast('Montant invalide', 'danger'); return; }
    if (this.avanceForm.sourceFinancement === 'BANQUE' && !this.avanceForm.compteId) {
      this.toast('Choisissez un compte bancaire', 'warning'); return;
    }
    const motif = [this.avanceForm.reference, this.avanceForm.observation].filter(v => v && v.trim()).join(' - ') || undefined;
    this.productService.enregistrerAvanceFournisseur({
      fournisseurId: this.avanceForm.fournisseurId,
      montant: this.avanceForm.montant,
      sourceFinancement: this.avanceForm.sourceFinancement,
      compteId: this.avanceForm.compteId,
      motif,
      utilisateurId: this.auth.getUserId()
    }).subscribe({
      next: () => {
        this.toast('Avance enregistrée');
        this.showAvanceModal = false;
        this.loadDetails(this.avanceForm.fournisseurId);
      },
      error: err => this.toast(err?.error?.message || 'Avance impossible', 'danger')
    });
  }

  // ======= Reçu =======

  imprimerRecuPaiement(paiement: any): void {
    if (!this.selectedFournisseur) return;
    this.factureService.ouvrirRecuPaiementFournisseur(paiement, this.selectedFournisseur);
  }

  // ======= Top Produits achetés (situation) =======

  get topProduits(): { nom: string; quantite: number }[] {
    const map = new Map<string, number>();
    for (const a of this.achats) {
      if (a.statut === 'ANNULE') continue;
      for (const l of (a.lignes || [])) {
        const nom = l.produitNom || l.produit?.nom || l.designation || 'Inconnu';
        map.set(nom, (map.get(nom) || 0) + Number(l.quantite || 0));
      }
    }
    return Array.from(map.entries())
      .map(([nom, quantite]) => ({ nom, quantite }))
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 5);
  }

  // ======= PDF Fiche Fournisseur =======

  ouvrirFichePdf(): void {
    if (!this.selectedFournisseur) { this.toast('Sélectionnez un fournisseur d\'abord', 'danger'); return; }
    const f = this.selectedFournisseur;
    const shop = this.boutiqueService.getInfo();
    const qrData = encodeURIComponent(f.telephone || f.nom);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;
    const date = new Date().toLocaleDateString('fr-FR');

    const lignesAchats = this.achatsActifs.map((a, i) => {
      const produitDetails = (a.lignes || []).map((l: any) =>
        `<tr style="background:#f1f5f9">
          <td colspan="3" style="padding:4px 24px;font-size:11px;color:#475569">
            &bull; ${l.produitNom || l.produit?.nom || '?'} &times;${l.quantite} @ ${this.money(l.prixAchatUnitaire)}
          </td>
          <td style="padding:4px 8px;font-size:11px;color:#0f172a;text-align:right">${this.money((l.quantite || 0) * (l.prixAchatUnitaire || 0))}</td>
        </tr>`
      ).join('');
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px">${this.formatDate(a.dateAchat || a.dateCreation)}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:700">${this.money(a.montantTotal)}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#16a34a">${this.money(a.montantPaye)}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:${(a.montantRestant || 0) > 0 ? '#dc2626' : '#16a34a'}">${this.money(a.montantRestant || 0)}</td>
      </tr>${produitDetails}`;
    }).join('');

    const lignesPaiements = this.paiements.map((p, i) =>
      `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px">${this.formatDate(p.datePaiement)}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:700;color:#16a34a">${this.money(p.montant)}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px">${p.modePaiement || '—'}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">${p.reference || '—'}</td>
      </tr>`
    ).join('');

    const lignesTop = this.topProduits.map((t, i) =>
      `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:700;color:#1a56db">${i + 1}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">${t.nom}</td>
        <td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700">${t.quantite}</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche Fournisseur - ${f.nom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:24px;font-size:13px;color:#1e293b}
.sheet{background:#fff;max-width:860px;margin:0 auto;border-radius:12px;box-shadow:0 4px 24px rgba(8,22,72,.10);overflow:hidden}
.hdr{background:linear-gradient(135deg,#081648,#1a56db);color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start}
.hdr-left h1{font-size:22px;font-weight:900;margin-bottom:4px}
.hdr-left p{font-size:12px;opacity:.75;margin-top:3px}
.body{padding:24px 32px}
.section-title{font-size:11px;font-weight:800;color:#1a56db;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.stat{border-radius:10px;padding:14px;text-align:center;color:#fff}
.stat--blue{background:#1a56db}.stat--green{background:#0e9f6e}.stat--orange{background:#f59e0b;color:#1a1a1a}.stat--purple{background:#7c4dff}
.stat-val{font-size:15px;font-weight:900;margin-bottom:2px}
.stat-lbl{font-size:10px;opacity:.85}
table{width:100%;border-collapse:collapse;margin-top:8px}
thead tr{background:linear-gradient(135deg,#081648,#1a56db);color:#fff}
thead th{padding:9px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left;border:1px solid rgba(255,255,255,.1)}
.ftr{background:#f1f5f9;padding:14px 32px;font-size:11px;color:#64748b;text-align:center}
.btn-bar{display:flex;gap:8px;margin-bottom:16px}
.btn-print{background:#1a56db;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}
.btn-close{background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}
@media print{.btn-bar{display:none}body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div class="hdr-left">
      <h1>${f.nom}</h1>
      <p>Code : ${f.code || '—'}</p>
      ${f.telephone ? `<p>Tel : ${f.telephone}</p>` : ''}
      ${f.email ? `<p>${f.email}</p>` : ''}
      ${f.adresse ? `<p>${f.adresse}</p>` : ''}
    </div>
    <div style="text-align:right">
      <img src="${qrUrl}" width="90" height="90" style="border-radius:6px;background:#fff;padding:4px" alt="QR">
      <p style="font-size:10px;opacity:.7;margin-top:4px">Généré le ${date}</p>
    </div>
  </div>
  <div class="body">
    <div class="btn-bar">
      <button class="btn-print" onclick="window.print()">Imprimer / PDF</button>
      <button class="btn-close" onclick="window.close()">Fermer</button>
    </div>
    <div class="section-title">Résumé financier</div>
    <div class="stat-row">
      <div class="stat stat--blue"><div class="stat-val">${this.money(this.situation?.totalAchats || 0)}</div><div class="stat-lbl">Total achats</div></div>
      <div class="stat stat--green"><div class="stat-val">${this.money(this.situation?.totalPaiements || 0)}</div><div class="stat-lbl">Total payé</div></div>
      <div class="stat stat--orange"><div class="stat-val">${this.money(this.situation?.soldeRestant || this.situation?.dette || 0)}</div><div class="stat-lbl">Solde restant</div></div>
      <div class="stat stat--purple"><div class="stat-val">${this.money(this.soldeAvance)}</div><div class="stat-lbl">Avances</div></div>
    </div>
    ${this.achatsActifs.length ? `
    <div class="section-title">Achats (${this.achatsActifs.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Total</th><th>Payé</th><th>Reste</th></tr></thead>
      <tbody>${lignesAchats}</tbody>
    </table>` : ''}
    ${this.paiements.length ? `
    <div class="section-title">Paiements (${this.paiements.length})</div>
    <table>
      <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Référence</th></tr></thead>
      <tbody>${lignesPaiements}</tbody>
    </table>` : ''}
    ${this.topProduits.length ? `
    <div class="section-title">Top 5 produits achetés</div>
    <table>
      <thead><tr><th>#</th><th>Produit</th><th style="text-align:right">Qté totale</th></tr></thead>
      <tbody>${lignesTop}</tbody>
    </table>` : ''}
  </div>
  <div class="ftr">${shop.nom || 'Ges Boutique'} · Fiche fournisseur : ${f.nom} · ${date}</div>
</div>
</body></html>`;

    this.openLocalOverlay(html);
  }

  private openLocalOverlay(html: string): void {
    document.getElementById('four-overlay-root')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'four-overlay-root';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:rgba(0,0,0,.65)';
    const btnFloat = document.createElement('button');
    btnFloat.textContent = '✕';
    btnFloat.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:12px;background:rgba(0,0,0,.75);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:20px;font-weight:700;cursor:pointer;z-index:2;line-height:1';
    btnFloat.addEventListener('click', () => overlay.remove());
    overlay.appendChild(btnFloat);

    const frame = document.createElement('iframe');
    frame.style.cssText = 'flex:1;width:100%;border:none;background:#f8fafc';
    frame.setAttribute('srcdoc', html);

    const bar = document.createElement('div');
    bar.style.cssText = 'background:#1a56db;padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap';

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fermer';
    btnClose.style.cssText = 'background:#ef4444;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
    btnClose.addEventListener('click', () => overlay.remove());

    const btnPrint = document.createElement('button');
    btnPrint.textContent = '🖨 Imprimer';
    btnPrint.style.cssText = 'background:#fff;color:#1a56db;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
    btnPrint.addEventListener('click', () => frame.contentWindow?.print());

    bar.appendChild(btnClose);
    bar.appendChild(btnPrint);
    overlay.appendChild(frame);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);
  }

  // ======= Utilitaires =======

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

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await t.present();
  }
}
