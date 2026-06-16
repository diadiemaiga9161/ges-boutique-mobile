import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CaisseService } from './caisse.service';
import { ProductService, Produit } from './product.service';
import { VenteMap, VenteService } from './vente.service';

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
    private ventes: VenteService,
    private products: ProductService,
    private caisse: CaisseService
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
    const topProduits = (rapport.topProduits || []).slice(0, 10);

    const produitRows = topProduits.map((p: any) => `
      <tr><td>${p.nom}</td><td>${p.quantite}</td><td>${this.formaterPrixFCFA(p.chiffreAffaire)}</td></tr>
    `).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${titre}</title>
      <style>body{font-family:Arial,sans-serif;margin:24px;color:#111}
      h1{color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ccc;padding:8px;font-size:12px}th{background:#f3f4f6}
      .metric{display:flex;gap:16px;margin:12px 0}
      .card{padding:12px;border:1px solid #e5e7eb;border-radius:8px;min-width:120px}
      .card .label{font-size:11px;color:#6b7280}.card .val{font-size:18px;font-weight:bold;color:#0f766e}
      @media print{.no-print{display:none}}</style></head><body>
      <h1>${titre}</h1>
      <div class="metric">
        <div class="card"><div class="label">Chiffre d'affaires</div><div class="val">${this.formaterPrixFCFA(ca)}</div></div>
        <div class="card"><div class="label">Nombre de ventes</div><div class="val">${nbVentes}</div></div>
      </div>
      ${topProduits.length ? `<h2>Top produits</h2><table><thead><tr><th>Produit</th><th>Qté</th><th>CA</th></tr></thead><tbody>${produitRows}</tbody></table>` : ''}
      <p style="margin-top:20px;font-size:11px;color:#9ca3af">Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
      <button class="no-print" onclick="window.print()">Imprimer</button>
      <button class="no-print" style="margin-left:10px;padding:8px 18px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer" onclick="window.close()">✕ Fermer</button>
      <script>window.addEventListener('afterprint',function(){window.close();});<\/script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => { win.focus(); win.print(); win.addEventListener('afterprint', () => win.close()); }, 300);
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
}
