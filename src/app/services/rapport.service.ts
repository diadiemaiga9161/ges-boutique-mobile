import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CaisseService } from './caisse.service';
import { ProductService, Produit } from './product.service';
import { FactureService } from './facture.service';
import { environment } from '../../environments/environment';

export interface VenteParVendeurJour {
  vendeurId: number;
  vendeurNom: string;
  date: string;
  nbVentesComptant: number;
  nbVentesCredit: number;
  caComptant: number;
  caCredit: number;
  caTotal: number;
  nbVentesTotal: number;
}

/** Réponse de GET /api/ventes/statistiques/periode : totaux d'une période calculés par le
 *  serveur, sans la liste des ventes (léger même sur une année entière). */
export interface ResumePeriode {
  dateDebut: string;
  dateFin: string;
  nombreVentes: number;
  chiffreAffaireTotal: number;
  montantRemisesTotal: number;
  panierMoyen: number;
  beneficeTotal: number;
  topProduits: Array<{ nom: string; quantite: number; quantiteTexte?: string; chiffreAffaire: number }>;
  modePaiementStats: Array<{ mode: string; montant: number; pourcentage: number }>;
}

export interface StatistiquesGenerales {
  /** Période des chiffres « mensuel », « totalVentes », « panierMoyen » et des produits
   *  les plus vendus : le mois en cours. */
  periode: { dateDebut: string; dateFin: string; libelle: string };
  chiffreAffaire: {
    journalier: number;
    nombreVentesJour: number;
    mensuel: number;
    totalVentes: number;
    panierMoyen: number;
  };
  inventaire: {
    valeurTotale: number;
    produitsStockFaible: number;
    produitsRupture: number;
    totalProduits: number;
  };
  credits: {
    totalCredits: number;
    montantTotalCredits: number;
    creditsEnRetard: number;
    montantCreditsEnRetard: number;
  };
  produitsPlusVendus: Array<{
    nom: string;
    quantiteVendue: number;
    quantiteTexte?: string;
    chiffreAffaire: number;
  }>;
  modePaiementStats?: Array<{ mode: string; montant: number; pourcentage: number }>;
  categoriesStats?: Array<{ nom: string; chiffreAffaire: number; nombreVentes: number }>;
  vendeurs?: Array<{ vendeurId: number; vendeurNom: string; chiffreAffaire: number; nombreVentes: number }>;
  gainsPertes?: {
    totalRevenus: number;
    totalPertes: number;
    bilanNet: number;
    evolutionParRapportMoisPrecedent: number;
  };
}

export interface RapportHebdomadaire {
  debutSemaine: string;
  finSemaine: string;
  chiffreAffaireTotal: number;
  nombreVentes: number;
  montantRemisesTotal: number;
  topProduits: Array<{ nom: string; quantite: number; quantiteTexte?: string; chiffreAffaire: number }>;
  modePaiementStats?: Array<{ mode: string; montant: number; pourcentage: number }>;
}

export interface RapportMensuel {
  mois: string;
  annee: number;
  dateDebut: string;
  dateFin: string;
  chiffreAffaireTotal: number;
  nombreVentes: number;
  montantRemisesTotal: number;
  topProduits: Array<{ nom: string; quantite: number; quantiteTexte?: string; chiffreAffaire: number }>;
  modePaiementStats?: Array<{ mode: string; montant: number; pourcentage: number }>;
}

export interface RapportJournalier {
  date: string;
  chiffreAffaireTotal: number;
  beneficeTotal: number;
  nombreVentes: number;
  montantRemisesTotal: number;
  produitsEnStockFaible: number;
  valeurStockTotale: number;
  topProduits: Array<{
    nom: string;
    quantite: number;
    quantiteTexte?: string;
    chiffreAffaire: number;
  }>;
}

/** Réponse de GET /api/rapports/complet?dateDebut=...&dateFin=... — regroupe tout ce
 * qu'un rapport doit contenir pour une période donnée (utilisé pour enrichir le PDF
 * exporté depuis l'écran Rapports, quelle que soit la période sélectionnée). */
export interface RapportComplet {
  dateDebut: string;
  dateFin: string;
  nombreVentes: number;
  totalVentes: number;
  ventes: Array<{
    date: string;
    numeroVente: string;
    clientNom: string;
    modePaiement: string;
    montantTotal: number;
  }>;
  topProduits: Array<{ produitNom: string; quantiteVendue: number; ca: number }>;
  repartitionModePaiement: Array<{ mode: string; montant: number; nombre: number }>;
  resumeCredits: {
    nombreCredits: number;
    totalCredits: number;
    totalVerse: number;
    totalRestant: number;
  };
  nombreClients: number;
}

export interface LigneClassementVendeur {
  rang: number;
  vendeurId: number;
  nom: string;
  actif: boolean;
  nombreVentes: number;
  chiffreAffaires: number;
  evolution: number | null;
  benefice: number;
  panierMoyen: number;
  nombreCredits: number;
  montantCredits: number;
  creditsRecuperes: number;
  nombreAnnulations: number;
  montantAnnulations: number;
  remises: number;
}

export interface ClassementVendeurs {
  dateDebut: string;
  dateFin: string;
  vendeurs: LigneClassementVendeur[];
  totalChiffreAffaires: number;
  totalVentes: number;
}

@Injectable({
  providedIn: 'root'
})
export class RapportService {
  constructor(
    private http: HttpClient,
    private products: ProductService,
    private caisse: CaisseService,
    private factureService: FactureService
  ) {}

  /** Ruptures, stock faible et valeur du stock calculés par le serveur (sans la liste des produits). */
  getIndicateursStock(): Observable<{ valeurTotale: number; produitsStockFaible: number; produitsRupture: number; totalProduits: number }> {
    return this.http.get<{ valeurTotale: number; produitsStockFaible: number; produitsRupture: number; totalProduits: number }>(
      `${environment.apiUrl}/produits/indicateurs-stock`);
  }

  /** Totaux d'une période calculés par le serveur (jamais la liste des ventes). */
  getResumePeriode(dateDebut: string, dateFin: string, top = 8): Observable<ResumePeriode> {
    return this.http.get<ResumePeriode>(`${environment.apiUrl}/ventes/statistiques/periode`, {
      params: { dateDebut, dateFin, top: String(top) }
    });
  }

  /** Vue d'ensemble : chiffres du jour, du mois en cours (libellé fourni pour l'écran),
   *  stock et crédits. Ne télécharge plus l'historique des ventes. */
  obtenirStatistiquesGenerales(): Observable<StatistiquesGenerales> {
    const aujourdhui = new Date();
    const jour = this.formaterDate(aujourdhui);
    const debutMois = this.formaterDate(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1));
    const libelle = aujourdhui.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    return forkJoin({
      resumeJour: this.getResumePeriode(jour, jour, 1).pipe(catchError(() => of(null))),
      resumeMois: this.getResumePeriode(debutMois, jour).pipe(catchError(() => of(null))),
      // Chiffres seulement (plus les listes complètes des produits et des crédits en retard).
      stock: this.getIndicateursStock().pipe(catchError(() => of(null))),
      situationCredits: this.caisse.getSituationCredits().pipe(catchError(() => of(null)))
    }).pipe(
      map(({ resumeJour, resumeMois, stock, situationCredits }) => ({
        periode: { dateDebut: debutMois, dateFin: jour, libelle },
        chiffreAffaire: {
          journalier: resumeJour?.chiffreAffaireTotal || 0,
          nombreVentesJour: resumeJour?.nombreVentes || 0,
          mensuel: resumeMois?.chiffreAffaireTotal || 0,
          totalVentes: resumeMois?.nombreVentes || 0,
          panierMoyen: resumeMois?.panierMoyen || 0
        },
        inventaire: {
          valeurTotale: stock?.valeurTotale || 0,
          produitsStockFaible: stock?.produitsStockFaible || 0,
          produitsRupture: stock?.produitsRupture || 0,
          totalProduits: stock?.totalProduits || 0
        },
        credits: {
          totalCredits: situationCredits?.nombreCreditsNonRegles || 0,
          montantTotalCredits: situationCredits?.montantTotalCredits || situationCredits?.montantRestantTotal || 0,
          creditsEnRetard: situationCredits?.nombreCreditsEnRetard || 0,
          montantCreditsEnRetard: situationCredits?.montantTotalRetard || 0
        },
        produitsPlusVendus: (resumeMois?.topProduits || []).map(p => ({
          nom: p.nom,
          quantiteVendue: p.quantite,
          quantiteTexte: p.quantiteTexte,
          chiffreAffaire: p.chiffreAffaire
        })),
        modePaiementStats: resumeMois?.modePaiementStats || []
      }))
    );
  }

  genererRapportJournalier(date: string): Observable<RapportJournalier> {
    return forkJoin({
      resume: this.getResumePeriode(date, date).pipe(catchError(() => of(null))),
      produits: this.products.getProducts().pipe(catchError(() => of([])))
    }).pipe(
      map(({ resume, produits }) => ({
        date,
        chiffreAffaireTotal: resume?.chiffreAffaireTotal || 0,
        beneficeTotal: resume?.beneficeTotal || 0,
        nombreVentes: resume?.nombreVentes || 0,
        montantRemisesTotal: resume?.montantRemisesTotal || 0,
        produitsEnStockFaible: produits.filter(p => Number(p.quantite || 0) <= Number(p.seuilAlerte || 0)).length,
        valeurStockTotale: this.valeurStock(produits),
        topProduits: this.topProduitsResume(resume)
      }))
    );
  }

  genererRapportHebdomadaire(): Observable<RapportHebdomadaire> {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const debut = this.formaterDate(monday);
    const fin = this.formaterDate(today);

    return this.getResumePeriode(debut, fin).pipe(
      catchError(() => of(null)),
      map(resume => ({
        debutSemaine: debut,
        finSemaine: fin,
        chiffreAffaireTotal: resume?.chiffreAffaireTotal || 0,
        nombreVentes: resume?.nombreVentes || 0,
        montantRemisesTotal: resume?.montantRemisesTotal || 0,
        topProduits: this.topProduitsResume(resume),
        modePaiementStats: resume?.modePaiementStats || []
      }))
    );
  }

  genererRapportMensuel(): Observable<RapportMensuel> {
    const today = new Date();
    const debut = this.formaterDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const fin = this.formaterDate(today);
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    return this.getResumePeriode(debut, fin).pipe(
      catchError(() => of(null)),
      map(resume => ({
        mois: moisNoms[today.getMonth()],
        annee: today.getFullYear(),
        dateDebut: debut,
        dateFin: fin,
        chiffreAffaireTotal: resume?.chiffreAffaireTotal || 0,
        nombreVentes: resume?.nombreVentes || 0,
        montantRemisesTotal: resume?.montantRemisesTotal || 0,
        topProduits: this.topProduitsResume(resume),
        modePaiementStats: resume?.modePaiementStats || []
      }))
    );
  }

  genererRapportPeriodique(dateDebut: string, dateFin: string): Observable<any> {
    return this.getResumePeriode(dateDebut, dateFin).pipe(
      catchError(() => of(null)),
      map(resume => {
        const ca = resume?.chiffreAffaireTotal || 0;
        return {
          resume: {
            dateDebut,
            dateFin,
            chiffreAffaireTotal: ca,
            nombreVentes: resume?.nombreVentes || 0,
            montantRemisesTotal: resume?.montantRemisesTotal || 0,
            beneficeTotal: 0
          },
          topProduits: this.topProduitsResume(resume),
          modePaiementStats: resume?.modePaiementStats || [],
          gains: { totalRevenus: ca, beneficeBrut: 0, margeBrute: 0 },
          pertes: { totalPertes: 0 },
          bilanNet: ca
        };
      })
    );
  }

  private topProduitsResume(resume: ResumePeriode | null): Array<{ nom: string; quantite: number; quantiteTexte?: string; chiffreAffaire: number }> {
    return (resume?.topProduits || []).map(p => ({
      nom: p.nom,
      quantite: p.quantite,
      quantiteTexte: p.quantiteTexte,
      chiffreAffaire: p.chiffreAffaire
    }));
  }

  /** Récupère le rapport complet (ventes, top produits, répartition modes de paiement,
   * résumé crédits, nombre de clients) pour une plage de dates donnée. Utilisé pour
   * enrichir le PDF exporté depuis l'écran Rapports, quelle que soit la période choisie. */
  obtenirRapportComplet(dateDebut: string, dateFin: string): Observable<RapportComplet> {
    return this.http.get<RapportComplet>(`${environment.apiUrl}/rapports/complet?dateDebut=${dateDebut}&dateFin=${dateFin}`);
  }

  /** Classement des vendeurs (gérant) : CA, ventes, bénéfice, crédits, annulations, remises. */
  getClassementVendeurs(dateDebut: string, dateFin: string): Observable<ClassementVendeurs> {
    return this.http.get<ClassementVendeurs>(`${environment.apiUrl}/rapports/classement-vendeurs?dateDebut=${dateDebut}&dateFin=${dateFin}`);
  }

  /** Exporte en PDF le rapport complet (ventes, top produits, modes de paiement, crédits,
   * clients servis) pour la période [dateDebut, dateFin] — même mécanisme pour toutes les
   * périodes (journalier/hebdomadaire/mensuel/annuel/personnalisé), seule la plage de dates
   * et le titre changent selon la période active à l'écran. */
  exporterRapportPDF(dateDebut: string, dateFin: string, titre: string): void {
    this.obtenirRapportComplet(dateDebut, dateFin).subscribe({
      next: rapport => this.construireEtOuvrirPdfRapportComplet(rapport, titre),
      error: () => {
        // Rapport complet indisponible (serveur hors-ligne, etc.) : rien de fiable à
        // exporter — le composant appelant affiche déjà un toast d'erreur générique
        // via son propre traitement d'erreur HTTP habituel.
      }
    });
  }

  private construireEtOuvrirPdfRapportComplet(rapport: RapportComplet, titre: string): void {
    const ventesLignes = (rapport.ventes || []).map(v => [
      this.formatDateShort(v.date),
      v.numeroVente || '',
      v.clientNom || 'Client divers',
      this.getModePaiementLabel(v.modePaiement),
      this.formaterPrixFCFA(v.montantTotal || 0)
    ]);

    const topProduitsLignes = (rapport.topProduits || []).map(p => [
      p.produitNom || '',
      String(p.quantiteVendue || 0),
      this.formaterPrixFCFA(p.ca || 0)
    ]);

    const modesLignes = (rapport.repartitionModePaiement || []).map(m => [
      this.getModePaiementLabel(m.mode),
      this.formaterPrixFCFA(m.montant || 0),
      String(m.nombre || 0)
    ]);

    const rc = rapport.resumeCredits;
    const creditsLignes = [
      ['Nombre de crédits', String(rc?.nombreCredits || 0)],
      ['Montant total', this.formaterPrixFCFA(rc?.totalCredits || 0)],
      ['Montant versé', this.formaterPrixFCFA(rc?.totalVerse || 0)],
      ['Restant dû', this.formaterPrixFCFA(rc?.totalRestant || 0)]
    ];

    this.factureService.ouvrirRapportCompletPDF({
      titre,
      sousTitre: `Du ${this.formatDateShort(rapport.dateDebut)} au ${this.formatDateShort(rapport.dateFin)} · `
        + `CA : ${this.formaterPrixFCFA(rapport.totalVentes)} · Ventes : ${rapport.nombreVentes} · `
        + `Clients servis : ${rapport.nombreClients || 0}`,
      sections: [
        {
          titre: 'Liste des ventes',
          colonnes: ['Date', 'N° Vente', 'Client', 'Mode paiement', 'Montant'],
          lignes: ventesLignes.length ? ventesLignes : [['Aucune vente sur cette période', '', '', '', '']]
        },
        {
          titre: 'Produits les plus vendus',
          colonnes: ['Produit', 'Quantité vendue', "Chiffre d'affaires"],
          lignes: topProduitsLignes.length ? topProduitsLignes : [['Aucun produit vendu', '', '']]
        },
        {
          titre: 'Répartition par mode de paiement',
          colonnes: ['Mode de paiement', 'Montant', 'Nombre de transactions'],
          lignes: modesLignes.length ? modesLignes : [['Aucune donnée', '', '']]
        },
        {
          titre: 'Résumé des crédits',
          colonnes: ['Indicateur', 'Valeur'],
          lignes: creditsLignes
        }
      ]
    });
  }

  getModePaiementLabel(mode: string): string {
    const labels: Record<string, string> = {
      ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', MOOV_MONEY: 'Moov Money',
      WAVE_MONEY: 'Wave', CARTE_BANCAIRE: 'Carte bancaire', VIREMENT: 'Virement'
    };
    return labels[mode] || mode;
  }

  formatDateLong(value: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  }

  formatDateShort(value: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formaterPrixFCFA(value: number): string {
    const n = Math.round(value || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
  }

  formaterDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private valeurStock(produits: Produit[]): number {
    return produits.reduce((sum, product) => sum + Number(product.prixAchat || 0) * Number(product.quantite || 0), 0);
  }

  getCA30Jours(): Observable<Array<{date: string, ca: number}>> {
    return this.http.get<Array<{date: string, ca: number}>>(`${environment.apiUrl}/rapports/ca-30-jours`);
  }
  getTopProduits(): Observable<Array<{produitNom: string, quantiteVendue: number, ca: number}>> {
    return this.http.get<Array<{produitNom: string, quantiteVendue: number, ca: number}>>(`${environment.apiUrl}/rapports/top-produits`);
  }
  getVentesParHeure(): Observable<Array<{heure: number, nbVentes: number}>> {
    return this.http.get<Array<{heure: number, nbVentes: number}>>(`${environment.apiUrl}/rapports/ventes-par-heure`);
  }
  getMarges(): Observable<Array<{produitNom: string, ca: number, coutAchat: number, marge: number, tauxMarge: number}>> {
    return this.http.get<any[]>(`${environment.apiUrl}/rapports/marges`);
  }
  getPrevisionStock(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/previsions/stock`);
  }

  getVentesParVendeur(dateDebut?: string, dateFin?: string): Observable<VenteParVendeurJour[]> {
    const params = (dateDebut && dateFin) ? `?dateDebut=${dateDebut}&dateFin=${dateFin}` : '';
    return this.http.get<VenteParVendeurJour[]>(`${environment.apiUrl}/rapports/ventes-par-vendeur${params}`);
  }
}
