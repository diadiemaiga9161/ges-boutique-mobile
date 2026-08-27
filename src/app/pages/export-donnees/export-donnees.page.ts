import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from '../../services/auth.service';
import { BoutiqueService } from '../../services/boutique.service';
import { FactureService } from '../../services/facture.service';
import { ExportExcelService } from '../../services/export-excel.service';

import { ClientService, Client } from '../../services/client.service';
import { ProductService, Produit, Fournisseur } from '../../services/product.service';
import { VenteService, VenteMap } from '../../services/vente.service';
import { DepenseService, Depense } from '../../services/depense.service';
import { EmployeService, Employe } from '../../services/employe.service';
import { CaisseService, CreditInfo } from '../../services/caisse.service';
import { TransfertService, TransfertStock } from '../../services/transfert.service';

type CategorieExportKey = 'CLIENTS' | 'PRODUITS' | 'VENTES' | 'FOURNISSEURS' | 'DEPENSES' | 'EMPLOYES' | 'CREDITS' | 'TRANSFERTS';

interface CategorieExportConfig {
  key: CategorieExportKey;
  labelKey: string;
  icon: string;
  hasDateRange: boolean;
}

interface ExportData {
  titre: string;
  sousTitre: string;
  colonnes: string[];
  lignes: string[][];
  totaux?: string[];
}

@Component({
  selector: 'app-export-donnees',
  templateUrl: './export-donnees.page.html',
  styleUrls: ['./export-donnees.page.scss'],
  standalone: false
})
export class ExportDonneesPage {

  isAdmin = false;
  loading = false;
  exportingExcel = false;

  categories: CategorieExportConfig[] = [
    { key: 'CLIENTS',      labelKey: 'EXPORT.CAT_CLIENTS',      icon: 'people-outline',            hasDateRange: false },
    { key: 'PRODUITS',     labelKey: 'EXPORT.CAT_PRODUITS',     icon: 'cube-outline',               hasDateRange: false },
    { key: 'VENTES',       labelKey: 'EXPORT.CAT_VENTES',       icon: 'receipt-outline',            hasDateRange: true },
    { key: 'FOURNISSEURS', labelKey: 'EXPORT.CAT_FOURNISSEURS', icon: 'business-outline',           hasDateRange: false },
    { key: 'DEPENSES',     labelKey: 'EXPORT.CAT_DEPENSES',     icon: 'trending-down-outline',      hasDateRange: true },
    { key: 'EMPLOYES',     labelKey: 'EXPORT.CAT_EMPLOYES',     icon: 'person-add-outline',         hasDateRange: false },
    { key: 'CREDITS',      labelKey: 'EXPORT.CAT_CREDITS',      icon: 'time-outline',               hasDateRange: true },
    { key: 'TRANSFERTS',   labelKey: 'EXPORT.CAT_TRANSFERTS',   icon: 'swap-horizontal-outline',    hasDateRange: true },
  ];

  selectedCategorie: CategorieExportConfig = this.categories[0];

  // Filtre optionnel par plage de dates (Ventes, Dépenses, Crédits/Dettes, Transferts)
  dateDebut = '';
  dateFin = '';

  donnees: any[] = [];

  // Aperçu (5 premières lignes) — recalculé à chaque chargement, pas à chaque cycle de détection de changement
  previewColonnes: string[] = [];
  previewLignes: string[][] = [];

  constructor(
    private auth: AuthService,
    private boutiqueService: BoutiqueService,
    private factureService: FactureService,
    private exportExcelService: ExportExcelService,
    private toastCtrl: ToastController,
    private translate: TranslateService,
    private clientService: ClientService,
    private productService: ProductService,
    private venteService: VenteService,
    private depenseService: DepenseService,
    private employeService: EmployeService,
    private caisseService: CaisseService,
    private transfertService: TransfertService
  ) {}

  ionViewWillEnter(): void {
    this.isAdmin = this.auth.isAdmin();
    if (this.isAdmin) {
      this.charger();
    }
  }

  selectionnerCategorie(cat: CategorieExportConfig): void {
    if (this.selectedCategorie.key === cat.key) return;
    this.selectedCategorie = cat;
    this.dateDebut = '';
    this.dateFin = '';
    this.charger();
  }

  filtrerParDate(): void {
    this.charger();
  }

  effacerDates(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.charger();
  }

  charger(event?: any): void {
    this.loading = true;
    this.chargerObservable().subscribe({
      next: data => {
        this.donnees = data || [];
        this.rafraichirApercu();
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.donnees = [];
        this.rafraichirApercu();
        this.loading = false;
        event?.target?.complete();
        this.toast('EXPORT.ERREUR_CHARGEMENT', 'danger');
      }
    });
  }

  /** Reconstruit l'aperçu (en-têtes + 5 premières lignes) après chargement des données. */
  private rafraichirApercu(): void {
    if (!this.donnees.length) {
      this.previewColonnes = [];
      this.previewLignes = [];
      return;
    }
    const cfg = this.construireExport();
    this.previewColonnes = cfg.colonnes;
    this.previewLignes = cfg.lignes.slice(0, 5);
  }

  private chargerObservable(): Observable<any[]> {
    const periodeActive = !!(this.dateDebut && this.dateFin);

    switch (this.selectedCategorie.key) {
      case 'CLIENTS':
        return this.clientService.getAll();

      case 'PRODUITS':
        return this.productService.getProducts();

      case 'FOURNISSEURS':
        return this.productService.getAllFournisseurs();

      case 'EMPLOYES':
        return this.employeService.getTous();

      case 'VENTES':
        return periodeActive
          ? this.venteService.getVentesParPeriode(this.dateDebut, this.dateFin)
          : this.venteService.getAllVentes(true);

      case 'DEPENSES':
        return periodeActive
          ? this.depenseService.getParPeriode(this.dateDebut, this.dateFin).pipe(map(r => r.depenses))
          : this.depenseService.getAll().pipe(map(r => r.depenses));

      case 'TRANSFERTS':
        return this.transfertService.getTout().pipe(
          map((liste: TransfertStock[]) => liste.filter(t => this.dansPeriode(t.dateCreation)))
        );

      case 'CREDITS':
        return forkJoin({
          nonRegles: this.caisseService.getCreditsNonRegles(),
          regles: this.caisseService.getCreditsRegles()
        }).pipe(
          map(({ nonRegles, regles }) => [...nonRegles, ...regles].filter((c: CreditInfo) => this.dansPeriode(c.dateOperation)))
        );

      default:
        return of([]);
    }
  }

  /** Filtre client (pas de période côté backend) sur dateDebut/dateFin — mêmes bornes que credits.page.ts. */
  private dansPeriode(dateStr?: string): boolean {
    if (!this.dateDebut && !this.dateFin) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (this.dateDebut && d < new Date(this.dateDebut)) return false;
    if (this.dateFin && d > new Date(this.dateFin + 'T23:59:59')) return false;
    return true;
  }

  // ══════════════ EXPORT PDF / EXCEL ══════════════

  exporterPDF(): void {
    if (!this.donnees.length) { this.toast('EXPORT.AUCUNE_DONNEE', 'warning'); return; }
    const cfg = this.construireExport();
    this.factureService.ouvrirDocumentPDF({ ...cfg, paysage: true });
  }

  async exporterExcel(): Promise<void> {
    if (!this.donnees.length) { this.toast('EXPORT.AUCUNE_DONNEE', 'warning'); return; }
    this.exportingExcel = true;
    try {
      const cfg = this.construireExport();
      const nomFichier = `${this.selectedCategorie.key}_${new Date().toISOString().split('T')[0]}`;
      await this.exportExcelService.exporterExcel(nomFichier, cfg.titre, cfg.colonnes, cfg.lignes);
      this.toast('EXPORT.SUCCES_EXCEL');
    } catch {
      this.toast('EXPORT.ERREUR_EXCEL', 'danger');
    } finally {
      this.exportingExcel = false;
    }
  }

  private construireExport(): ExportData {
    const shop = this.boutiqueService.getInfo();
    const dateGen = new Date().toLocaleDateString('fr-FR');
    const periode = (this.selectedCategorie.hasDateRange && (this.dateDebut || this.dateFin))
      ? ` — Période : ${this.dateDebut || '…'} au ${this.dateFin || '…'}`
      : '';
    const sousTitre = `${shop.nom || 'Ges Boutique'} — Généré le ${dateGen}${periode}`;

    switch (this.selectedCategorie.key) {
      case 'CLIENTS':      return this.exportClients(sousTitre);
      case 'PRODUITS':     return this.exportProduits(sousTitre);
      case 'VENTES':       return this.exportVentes(sousTitre);
      case 'FOURNISSEURS': return this.exportFournisseurs(sousTitre);
      case 'DEPENSES':     return this.exportDepenses(sousTitre);
      case 'EMPLOYES':     return this.exportEmployes(sousTitre);
      case 'CREDITS':      return this.exportCredits(sousTitre);
      case 'TRANSFERTS':   return this.exportTransferts(sousTitre);
    }
  }

  private exportClients(sousTitre: string): ExportData {
    const clients = this.donnees as Client[];
    return {
      titre: 'Export — Clients',
      sousTitre,
      colonnes: ['Nom', 'Prénom', 'Téléphone', 'Adresse', 'Email', 'Solde avance'],
      lignes: clients.map(c => [
        c.nom || '',
        c.prenom || '-',
        c.telephone || c.numeroTelephone || '-',
        c.adresse || '-',
        c.email || '-',
        this.money(c.soldeAvance || 0)
      ])
    };
  }

  private exportProduits(sousTitre: string): ExportData {
    const produits = this.donnees as Produit[];
    const valeurAchat = this.productService.calculateTotalStockValue(produits);
    const valeurVente = this.productService.calculateTotalSellingValue(produits);
    return {
      titre: 'Export — Produits (stock)',
      sousTitre,
      colonnes: ['Nom', 'Catégorie', 'Fournisseur', 'Prix achat', 'Prix vente', 'Stock', 'Seuil alerte', 'Statut'],
      lignes: produits.map(p => [
        p.nom,
        p.categorieNom || '-',
        p.fournisseurNom || '-',
        this.money(p.prixAchat),
        this.money(p.prixVente),
        String(p.quantite),
        String(p.seuilAlerte),
        p.perime ? 'Périmé' : (p.stockFaible ? 'Stock faible' : 'OK')
      ]),
      totaux: [
        `Valeur stock (prix achat) : ${this.money(valeurAchat)}`,
        `Valeur stock (prix vente) : ${this.money(valeurVente)}`
      ]
    };
  }

  private exportVentes(sousTitre: string): ExportData {
    const ventes = this.donnees as VenteMap[];
    const total = ventes.reduce((s, v) => s + (v.montantApresRemise || v.montantTotal), 0);
    return {
      titre: 'Export — Ventes',
      sousTitre,
      colonnes: ['N° Vente', 'Date', 'Client', 'Vendeur', 'Type', 'Mode paiement', 'Montant', 'Annulée'],
      lignes: ventes.map(v => [
        v.numeroVente,
        this.formatDate(v.dateVente),
        v.clientNom || 'Client divers',
        v.vendeurNom || '-',
        v.estCredit ? 'Crédit' : 'Comptant',
        this.venteService.getModePaiementLabel(v.modePaiement) || '-',
        this.money(v.montantApresRemise || v.montantTotal),
        v.annulee ? 'Oui' : 'Non'
      ]),
      totaux: [`Total : ${this.money(total)}`, `${ventes.length} vente(s)`]
    };
  }

  private exportFournisseurs(sousTitre: string): ExportData {
    const fournisseurs = this.donnees as Fournisseur[];
    return {
      titre: 'Export — Fournisseurs',
      sousTitre,
      colonnes: ['Nom', 'Code', 'Téléphone', 'Email', 'Adresse', 'Solde', 'Statut'],
      lignes: fournisseurs.map(f => [
        f.nom,
        f.code || '-',
        f.telephone || '-',
        f.email || '-',
        f.adresse || '-',
        this.money(f.solde || 0),
        f.actif === false ? 'Inactif' : 'Actif'
      ])
    };
  }

  private exportDepenses(sousTitre: string): ExportData {
    const depenses = this.donnees as Depense[];
    const total = depenses.reduce((s, d) => s + (d.montant || 0), 0);
    return {
      titre: 'Export — Dépenses',
      sousTitre,
      colonnes: ['Date', 'Nom', 'Type', 'Motif', 'Montant'],
      lignes: depenses.map(d => [
        d.date || '-',
        d.nom,
        d.typeDepense || '-',
        d.motif || '-',
        this.money(d.montant)
      ]),
      totaux: [`Total : ${this.money(total)}`, `${depenses.length} dépense(s)`]
    };
  }

  private exportEmployes(sousTitre: string): ExportData {
    const employes = this.donnees as Employe[];
    return {
      titre: 'Export — Employés',
      sousTitre,
      colonnes: ['Nom complet', 'Poste', 'Téléphone', 'Salaire mensuel', 'Statut', "Date d'embauche"],
      lignes: employes.map(e => [
        e.nomComplet || [e.prenom, e.nom].filter(Boolean).join(' '),
        e.poste || '-',
        e.telephone || '-',
        this.money(e.salaireMensuel || 0),
        e.statut === 'INACTIF' ? 'Inactif' : 'Actif',
        e.dateEmbauche ? this.formatDate(e.dateEmbauche) : '-'
      ])
    };
  }

  private exportCredits(sousTitre: string): ExportData {
    const credits = this.donnees as CreditInfo[];
    const totalRestant = credits.reduce((s, c) => s + (c.estReglee ? 0 : c.montantRestant), 0);
    return {
      titre: 'Export — Crédits / Dettes',
      sousTitre,
      colonnes: ['Client', 'Téléphone', 'N° Vente', 'Montant total', 'Versé', 'Restant', 'Statut'],
      lignes: credits.map(c => [
        [c.clientNom, c.clientPrenom].filter(Boolean).join(' ') || 'Client divers',
        c.clientTelephone || '-',
        c.numeroVente,
        this.money(c.montantTotal),
        this.money(c.montantVerse),
        this.money(c.montantRestant),
        c.estReglee ? 'Réglé' : (c.enRetard ? 'En retard' : 'En cours')
      ]),
      totaux: [`Restant dû (total) : ${this.money(totalRestant)}`, `${credits.length} crédit(s)`]
    };
  }

  private exportTransferts(sousTitre: string): ExportData {
    const transferts = this.donnees as TransfertStock[];
    return {
      titre: 'Export — Transferts',
      sousTitre,
      colonnes: ['N°', 'Date', 'De', 'Vers', 'Statut', 'Type paiement', 'Créé par'],
      lignes: transferts.map(t => [
        t.numeroTransfert || '-',
        t.dateCreation ? this.formatDate(t.dateCreation) : '-',
        t.boutiqueSourceNom || '-',
        t.boutiqueDestNom || '-',
        t.statut || '-',
        t.typePaiement || '-',
        t.creePar || '-'
      ])
    };
  }

  // ══════════════ UTILITAIRES ══════════════

  money(v: number): string {
    const n = Math.round(v || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
  }

  formatDate(d?: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR');
  }

  private async toast(cle: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const message = await this.translate.get(cle).toPromise();
    const t = await this.toastCtrl.create({ message, duration: 2500, position: 'top', color });
    await t.present();
  }
}
