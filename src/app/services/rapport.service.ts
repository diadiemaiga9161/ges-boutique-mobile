import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CaisseService } from './caisse.service';
import { ProductService, Produit } from './product.service';
import { VenteMap, VenteService } from './vente.service';
import { FactureService } from './facture.service';
import { environment } from '../../environments/environment';

export interface StatistiquesGenerales {
  chiffreAffaire: {
    journalier: number;
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
  topProduits: Array<{ nom: string; quantite: number; chiffreAffaire: number }>;
  modePaiementStats?: Array<{ mode: string; montant: number; pourcentage: number }>;
}

export interface RapportMensuel {
  mois: string;
  annee: number;
  chiffreAffaireTotal: number;
  nombreVentes: number;
  montantRemisesTotal: number;
  topProduits: Array<{ nom: string; quantite: number; chiffreAffaire: number }>;
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
    chiffreAffaire: number;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class RapportService {
  constructor(
    private http: HttpClient,
    private ventes: VenteService,
    private products: ProductService,
    private caisse: CaisseService,
    private factureService: FactureService
  ) {}

  obtenirStatistiquesGenerales(): Observable<StatistiquesGenerales> {
    return forkJoin({
      ventes: this.ventes.getAllVentes().pipe(catchError(() => of([]))),
      produits: this.products.getProducts().pipe(catchError(() => of([]))),
      situationCredits: this.caisse.getSituationCredits().pipe(catchError(() => of(null))),
      creditsRetard: this.caisse.getCreditsEnRetard().pipe(catchError(() => of([])))
    }).pipe(
      map(({ ventes, produits, situationCredits, creditsRetard }) => {
        const total = this.totalVentes(ventes);
        const today = new Date().toISOString().split('T')[0];
        const ventesJour = ventes.filter(vente => vente.dateVente?.startsWith(today));
        const valeurStock = produits.reduce((sum, p) => sum + (Number(p.prixAchat || 0) * Number(p.quantite || 0)), 0);

        return {
          chiffreAffaire: {
            journalier: this.totalVentes(ventesJour),
            mensuel: total,
            totalVentes: ventes.length,
            panierMoyen: ventes.length ? total / ventes.length : 0
          },
          inventaire: {
            valeurTotale: valeurStock,
            produitsStockFaible: produits.filter(p => Number(p.quantite || 0) <= Number(p.seuilAlerte || 0)).length,
            produitsRupture: produits.filter(p => Number(p.quantite || 0) <= 0).length,
            totalProduits: produits.length
          },
          credits: {
            totalCredits: situationCredits?.nombreCreditsNonRegles || 0,
            montantTotalCredits: situationCredits?.montantTotalCredits || situationCredits?.montantRestantTotal || 0,
            creditsEnRetard: creditsRetard.length,
            montantCreditsEnRetard: creditsRetard.reduce((sum, credit) => sum + Number(credit.montantRestant || 0), 0)
          },
          produitsPlusVendus: this.getTopProduits(ventes).slice(0, 8)
        };
      })
    );
  }

  genererRapportJournalier(date: string): Observable<RapportJournalier> {
    return forkJoin({
      ventes: this.ventes.getVentesParPeriode(date, date).pipe(catchError(() => of([]))),
      produits: this.products.getProducts().pipe(catchError(() => of([])))
    }).pipe(
      map(({ ventes, produits }) => {
        const beneficeTotal = ventes.reduce((total, vente) => {
          if (!Array.isArray(vente.produits)) return total;
          return total + vente.produits.reduce((sum, ligne) => {
            const produit = produits.find(p => p.id === ligne.produitId);
            const prixAchat = Number(produit?.prixAchat || 0);
            const prixVente = Number(ligne.prixApresRemise ?? ligne.prixUnitaire ?? 0);
            return sum + (prixVente - prixAchat) * Number(ligne.quantite || 0);
          }, 0);
        }, 0);

        return {
          date,
          chiffreAffaireTotal: this.totalVentes(ventes),
          beneficeTotal,
          nombreVentes: ventes.length,
          montantRemisesTotal: ventes.reduce((sum, vente) => sum + Number(vente.montantRemiseTotal || 0), 0),
          produitsEnStockFaible: produits.filter(p => Number(p.quantite || 0) <= Number(p.seuilAlerte || 0)).length,
          valeurStockTotale: this.valeurStock(produits),
          topProduits: this.getTopProduits(ventes).slice(0, 8).map(item => ({
            nom: item.nom,
            quantite: item.quantiteVendue,
            chiffreAffaire: item.chiffreAffaire
          }))
        };
      })
    );
  }

  genererRapportHebdomadaire(): Observable<RapportHebdomadaire> {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const debut = this.formaterDate(monday);
    const fin = this.formaterDate(today);

    return this.ventes.getVentesParPeriode(debut, fin).pipe(
      catchError(() => of([])),
      map(ventesListe => ({
        debutSemaine: debut,
        finSemaine: fin,
        chiffreAffaireTotal: this.totalVentes(ventesListe),
        nombreVentes: ventesListe.length,
        montantRemisesTotal: ventesListe.reduce((s, v) => s + Number(v.montantRemiseTotal || 0), 0),
        topProduits: this.getTopProduits(ventesListe).slice(0, 8).map(p => ({ nom: p.nom, quantite: p.quantiteVendue, chiffreAffaire: p.chiffreAffaire })),
        modePaiementStats: this.calcModePaiementStats(ventesListe)
      }))
    );
  }

  genererRapportMensuel(): Observable<RapportMensuel> {
    const today = new Date();
    const debut = this.formaterDate(new Date(today.getFullYear(), today.getMonth(), 1));
    const fin = this.formaterDate(today);
    const moisNoms = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

    return this.ventes.getVentesParPeriode(debut, fin).pipe(
      catchError(() => of([])),
      map(ventesListe => ({
        mois: moisNoms[today.getMonth()],
        annee: today.getFullYear(),
        chiffreAffaireTotal: this.totalVentes(ventesListe),
        nombreVentes: ventesListe.length,
        montantRemisesTotal: ventesListe.reduce((s, v) => s + Number(v.montantRemiseTotal || 0), 0),
        topProduits: this.getTopProduits(ventesListe).slice(0, 8).map(p => ({ nom: p.nom, quantite: p.quantiteVendue, chiffreAffaire: p.chiffreAffaire })),
        modePaiementStats: this.calcModePaiementStats(ventesListe)
      }))
    );
  }

  genererRapportPeriodique(dateDebut: string, dateFin: string): Observable<any> {
    return this.ventes.getVentesParPeriode(dateDebut, dateFin).pipe(
      catchError(() => of([])),
      map(ventesListe => ({
        resume: {
          dateDebut,
          dateFin,
          chiffreAffaireTotal: this.totalVentes(ventesListe),
          nombreVentes: ventesListe.length,
          montantRemisesTotal: ventesListe.reduce((s, v) => s + Number(v.montantRemiseTotal || 0), 0),
          beneficeTotal: 0
        },
        topProduits: this.getTopProduits(ventesListe).slice(0, 8).map(p => ({ nom: p.nom, quantite: p.quantiteVendue, chiffreAffaire: p.chiffreAffaire })),
        modePaiementStats: this.calcModePaiementStats(ventesListe),
        gains: { totalRevenus: this.totalVentes(ventesListe), beneficeBrut: 0, margeBrute: 0 },
        pertes: { totalPertes: 0 },
        bilanNet: this.totalVentes(ventesListe)
      }))
    );
  }

  exporterRapportPDF(rapport: any, type: string): void {
    const titre = type === 'journalier' ? `Rapport du ${rapport.date || ''}` :
      type === 'hebdomadaire' ? `Rapport semaine du ${rapport.debutSemaine || ''}` :
      type === 'mensuel' ? `Rapport ${rapport.mois || ''} ${rapport.annee || ''}` :
      `Rapport du ${rapport.resume?.dateDebut || rapport.dateDebut || ''} au ${rapport.resume?.dateFin || rapport.dateFin || ''}`;

    const ca = rapport.chiffreAffaireTotal || rapport.resume?.chiffreAffaireTotal || 0;
    const nbVentes = rapport.nombreVentes || rapport.resume?.nombreVentes || 0;
    const topProduits: any[] = (rapport.topProduits || []).slice(0, 10);

    const lignes = topProduits.map((p: any) => [
      p.nom || '',
      String(p.quantite || 0),
      this.formaterPrixFCFA(p.chiffreAffaire || 0)
    ]);

    this.factureService.ouvrirDocumentPDF({
      titre,
      sousTitre: `CA : ${this.formaterPrixFCFA(ca)} · Ventes : ${nbVentes}`,
      colonnes: topProduits.length > 0 ? ['Produit', 'Quantité', 'CA'] : ['Données'],
      lignes: topProduits.length > 0 ? lignes : [['Aucun produit dans ce rapport']],
      totaux: [
        `Chiffre d'affaires : ${this.formaterPrixFCFA(ca)}`,
        `Nombre de ventes : ${nbVentes}`
      ]
    });
  }

  getModePaiementLabel(mode: string): string {
    const labels: Record<string, string> = {
      ESPECES: 'Espèces', ORANGE_MONEY: 'Orange Money', MOOV_MONEY: 'Moov Money',
      CARTE_BANCAIRE: 'Carte bancaire', VIREMENT: 'Virement'
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

  private calcModePaiementStats(ventes: VenteMap[]): Array<{ mode: string; montant: number; pourcentage: number }> {
    const total = this.totalVentes(ventes);
    const map = new Map<string, number>();
    ventes.forEach(v => {
      const mode = v.modePaiement || 'ESPECES';
      map.set(mode, (map.get(mode) || 0) + Number(v.montantTotal || 0));
    });
    return Array.from(map.entries()).map(([mode, montant]) => ({
      mode, montant, pourcentage: total > 0 ? (montant / total) * 100 : 0
    }));
  }

  formaterPrixFCFA(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  formaterDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getTopProduits(ventes: VenteMap[]): Array<{ nom: string; quantiteVendue: number; chiffreAffaire: number }> {
    const map = new Map<string, { quantiteVendue: number; chiffreAffaire: number }>();

    for (const vente of ventes) {
      for (const line of vente.produits || []) {
        const key = line.produitNom || 'Produit';
        const current = map.get(key) || { quantiteVendue: 0, chiffreAffaire: 0 };
        current.quantiteVendue += Number(line.quantite || 0);
        current.chiffreAffaire += Number(line.sousTotal || 0);
        map.set(key, current);
      }
    }

    return Array.from(map.entries())
      .map(([nom, data]) => ({ nom, ...data }))
      .sort((a, b) => b.quantiteVendue - a.quantiteVendue);
  }

  private totalVentes(ventes: VenteMap[]): number {
    return ventes.reduce((sum, vente) => sum + Number(vente.montantTotal || 0), 0);
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
}
