import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BoutiqueService } from './boutique.service';

export enum ModePaiement {
  ESPECES = 'ESPECES',
  ORANGE_MONEY = 'ORANGE_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
  CARTE_BANCAIRE = 'CARTE_BANCAIRE',
  VIREMENT = 'VIREMENT'
}

export enum RemiseType {
  POURCENTAGE = 'POURCENTAGE',
  MONTANT_FIXE = 'MONTANT_FIXE'
}

export interface LigneVenteRequest {
  produitId: number;
  quantite: number;
  prixUnitaire?: number | null;
  remisePourcentage?: number | null;
  remiseMontant?: number | null;
}

export interface VenteRequest {
  vendeurId: number;
  lignes: LigneVenteRequest[];
  modePaiement: ModePaiement | string;
  referencePaiement?: string;
  remiseGlobale?: number;
  typeRemiseGlobale?: RemiseType | string;
  estCredit?: boolean;
  clientId?: number;
  clientDivers?: boolean;
  creerClient?: boolean;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  dateEcheance?: string;
  montantVerse?: number;
}

export interface VenteCreditRequest extends VenteRequest {
  clientNom: string;
  dateEcheance: string;
  montantAvanceUtilise?: number;
}

export interface Client {
  id?: number;
  nom: string;
  prenom?: string;
  numeroTelephone?: string;
  telephone?: string;
  adresse?: string;
  email?: string;
  dateCreation?: string;
  soldeAvance?: number;
}

export interface VentesParTypeResponse {
  toutes: VenteMap[];
  comptant: VenteMap[];
  credit: VenteMap[];
}

export interface Statistiques {
  chiffreAffaireJournalier: number;
  chiffreAffaireHebdomadaire: number;
  chiffreAffaireMensuel: number;
  chiffreAffaireAnnuel: number;
  nombreVentesJour: number;
  nombreVentesTotales: number;
  ventesParMois: Array<{ mois: string; chiffreAffaire: number; nombreVentes: number }>;
  topProduits: Array<{ produitId: number; produitNom: string; quantite: number; chiffreAffaire: number }>;
  modePaiementStats: Array<{ mode: string; montant: number; pourcentage: number }>;
  vendeurs: Array<{ vendeurId: number; vendeurNom: string; chiffreAffaire: number; nombreVentes: number }>;
}

export interface StatistiquesCredits {
  nombreCreditsEnCours: number;
  montantTotalCreditsEnCours: number;
  nombreCreditsEnRetard: number;
  montantTotalCreditsEnRetard: number;
  nombreCreditsRegles: number;
  tauxRecouvrement: number;
}

export interface ReglementCreditRequest {
  venteId?: number;
  venteCreditId?: number;
  montantRegle: number;
  utilisateurId: number;
  modePaiement: string;
  referencePaiement?: string;
}

export interface LigneVenteDto {
  produitId: number;
  produitNom: string;
  quantite: number;
  prixUnitaire: number;
  prixAchat?: number;
  remisePourcentage?: number;
  remiseMontant?: number;
  prixApresRemise?: number;
  sousTotal: number;
}

export interface VenteMap {
  id: number;
  numeroVente: string;
  vendeurId: number;
  vendeurNom: string;
  montantTotal: number;
  montantRemiseTotal: number;
  montantApresRemise: number;
  modePaiement: string;
  referencePaiement?: string;
  dateVente: string;
  nombreProduits: number;
  lignes: LigneVenteDto[];
  produits: LigneVenteDto[];
  estCredit: boolean;
  clientId?: number;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  dateEcheance?: string;
  montantVerse?: number;
  montantRestant?: number;
  creditRegle?: boolean;
  annulee?: boolean;
}

export interface VentesDuJourResponse {
  ventes: VenteMap[];
  totalVentes: number;
  montantTotal: number;
  montantTotalComptant: number;
  montantTotalCredit: number;
}

export interface LigneRetourVenteRequest {
  ligneVenteId?: number;
  produitId: number;
  quantiteRetournee: number;
  prixUnitaire: number;
}

export interface RetourVenteRequest {
  venteId: number;
  motif?: string;
  utilisateurId?: number;
  lignes: LigneRetourVenteRequest[];
}

export interface CreditsNonReglesResponse {
  credits: VenteMap[];
  nombreCredits: number;
  montantTotal: number;
}

@Injectable({
  providedIn: 'root'
})
export class VenteService {
  private readonly apiUrl = `${environment.apiUrl}/ventes`;

  constructor(private http: HttpClient, private boutiqueService: BoutiqueService) {}

  createVente(vente: VenteRequest): Observable<VenteMap> {
    if (!vente.vendeurId) return throwError(() => new Error('Vendeur invalide'));
    if (!vente.lignes?.length) return throwError(() => new Error('La vente doit contenir au moins un produit'));

    return this.http.post<any>(this.apiUrl, this.cleanVente(vente)).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'créer la vente'))
    );
  }

  createVenteCredit(vente: VenteCreditRequest): Observable<VenteMap> {
    return this.http.post<any>(`${this.apiUrl}/credit`, this.cleanVente({ ...vente, estCredit: true })).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'créer la vente à crédit'))
    );
  }

  getVenteById(id: number): Observable<VenteMap> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'récupérer la vente'))
    );
  }

  getAllVentes(): Observable<VenteMap[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => this.mapVenteList(response)),
      catchError(error => this.handleError(error, 'récupérer les ventes'))
    );
  }

  getVentesParType(): Observable<VentesParTypeResponse> {
    return this.http.get<any>(`${this.apiUrl}/par-type`).pipe(
      map(response => ({
        toutes: this.mapVenteList(response?.toutes || response),
        comptant: this.mapVenteList(response?.comptant || []),
        credit: this.mapVenteList(response?.credit || [])
      })),
      catchError(() => this.getAllVentes().pipe(
        map(ventes => ({
          toutes: ventes,
          comptant: ventes.filter(v => !v.estCredit),
          credit: ventes.filter(v => v.estCredit)
        }))
      ))
    );
  }

  getStatistiquesChiffreAffaire(): Observable<Statistiques> {
    return this.http.get<any>(`${this.apiUrl}/statistiques`).pipe(
      map(response => response?.data || response),
      catchError(error => this.handleError(error, 'récupérer les statistiques'))
    );
  }

  getStatistiquesCredits(): Observable<StatistiquesCredits> {
    return this.http.get<any>(`${this.apiUrl}/credits/statistiques`).pipe(
      map(response => response?.data || response),
      catchError(error => this.handleError(error, 'récupérer les statistiques crédits'))
    );
  }

  getClients(): Observable<Client[]> {
    return this.http.get<any>(`${environment.apiUrl}/clients`).pipe(
      map(response => {
        const list = Array.isArray(response) ? response : (response?.clients || response?.data || []);
        return Array.isArray(list) ? list : [];
      }),
      catchError(error => this.handleError(error, 'récupérer les clients'))
    );
  }

  createClient(client: Partial<Client>): Observable<Client> {
    return this.http.post<any>(`${environment.apiUrl}/clients`, client).pipe(
      map(response => response?.client || response?.data || response),
      catchError(error => this.handleError(error, 'créer le client'))
    );
  }

  getCreditsParClient(nom: string): Observable<VenteMap[]> {
    const params = new HttpParams().set('clientNom', nom);
    return this.http.get<any>(`${this.apiUrl}/credits/client`, { params }).pipe(
      map(response => this.mapVenteList(response, 'credits')),
      catchError(error => this.handleError(error, 'récupérer les crédits du client'))
    );
  }

  getSoldeAvance(clientNom: string, clientTelephone?: string): Observable<{ soldeDisponible: number }> {
    let params = new HttpParams().set('clientNom', clientNom);
    if (clientTelephone) params = params.set('clientTelephone', clientTelephone);
    return this.http.get<any>(`${environment.apiUrl}/clients/avances/solde`, { params }).pipe(
      map(response => ({ soldeDisponible: Number(response?.soldeDisponible ?? response?.montantDisponible ?? 0) })),
      catchError(() => [{ soldeDisponible: 0 }])
    );
  }

  telechargerFacture(venteId: number): Observable<void> {
    return this.http.get(`${this.apiUrl}/${venteId}/facture`, { responseType: 'blob' }).pipe(
      map((blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facture-${venteId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      }),
      catchError(error => this.handleError(error, 'télécharger la facture'))
    );
  }

  exportVentesToPDF(ventes: VenteMap[], titre = 'VENTES'): void {
    const rows = ventes.map(v => `
      <tr>
        <td>${v.numeroVente}</td>
        <td>${this.formatDate(v.dateVente)}</td>
        <td>${v.clientNom || 'Client divers'}</td>
        <td>${v.vendeurNom || '-'}</td>
        <td>${v.estCredit ? 'Crédit' : 'Comptant'}</td>
        <td style="text-align:right">${this.formatPrice(v.montantTotal)}</td>
        <td>${v.modePaiement || '-'}</td>
      </tr>`).join('');

    const total = ventes.reduce((s, v) => s + v.montantTotal, 0);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${titre}</title>
      <style>body{font-family:Arial,sans-serif;margin:20px}h1{color:#0f766e}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;font-size:11px}
      th{background:#f3f4f6}.total{font-weight:bold;font-size:14px;color:#0f766e}
      @media print{.no-print{display:none}}</style></head><body>
      <h1>${titre}</h1>
      <p>Généré le ${new Date().toLocaleDateString('fr-FR')} · ${ventes.length} vente(s)</p>
      <table><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Vendeur</th><th>Type</th><th>Montant</th><th>Paiement</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="total">Total: ${this.formatPrice(total)}</p>
      <button class="no-print" onclick="window.print()">Imprimer</button>
      <button class="no-print" style="margin-left:10px;padding:8px 18px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer" onclick="window.close()">✕ Fermer</button>
      <script>window.addEventListener('afterprint',function(){window.close();});<\/script>
      </body></html>`;

    const win = window.open('', '_blank');
    if (!win) throw new Error('Impossible d\'ouvrir la fenêtre d\'impression');
    win.document.write(html);
    win.document.close();
    win.onload = () => setTimeout(() => { win.focus(); win.print(); win.addEventListener('afterprint', () => win.close()); }, 300);
  }

  exportVentesClientDetailToPDF(ventes: VenteMap[], clientNom: string, clientPrenom = ''): void {
    this.exportVentesToPDF(ventes, `VENTES_${clientNom}_${clientPrenom}`.trim());
  }

  exportVentesCreditDetailToPDF(credits: VenteMap[]): void {
    this.exportVentesToPDF(credits, 'CREDITS');
  }

  exportVentesClientDiversDetailToPDF(ventes: VenteMap[]): void {
    this.exportVentesToPDF(ventes, 'VENTES_CLIENTS_DIVERS');
  }

  exportCreditsRetardDetailToPDF(credits: VenteMap[]): void {
    this.exportVentesToPDF(credits, 'CREDITS_EN_RETARD');
  }

  getVentesComptant(): Observable<VenteMap[]> {
    return this.http.get<any>(`${this.apiUrl}/comptant`).pipe(
      map(response => this.mapVenteList(response)),
      catchError(error => this.handleError(error, 'récupérer les ventes comptant'))
    );
  }

  getVentesCredit(): Observable<VenteMap[]> {
    return this.http.get<any>(`${this.apiUrl}/credit`).pipe(
      map(response => this.mapVenteList(response, 'credits')),
      catchError(error => this.handleError(error, 'récupérer les ventes à crédit'))
    );
  }

  modifierVente(venteId: number, vente: VenteRequest): Observable<VenteMap> {
    return this.http.put<any>(`${this.apiUrl}/${venteId}`, this.cleanVente(vente)).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'modifier la vente'))
    );
  }

  modifierVenteCredit(venteId: number, vente: VenteCreditRequest): Observable<VenteMap> {
    return this.http.put<any>(`${this.apiUrl}/credits/${venteId}`, this.cleanVente({ ...vente, estCredit: true })).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'modifier le crédit'))
    );
  }

  getVenteCreditById(id: number): Observable<VenteMap> {
    return this.http.get<any>(`${this.apiUrl}/credit/${id}`).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'récupérer le crédit'))
    );
  }

  getVentePourModification(id: number, estCredit: boolean): Observable<VenteMap> {
    return estCredit ? this.getVenteCreditById(id) : this.getVenteById(id);
  }

  getVentesDuJour(): Observable<VentesDuJourResponse> {
    return this.http.get<any>(`${this.apiUrl}/aujourdhui`).pipe(
      map(response => {
        const ventes = this.mapVenteList(response);
        return {
          ventes,
          totalVentes: response?.totalVentes ?? ventes.length,
          montantTotal: response?.montantTotal ?? this.total(ventes),
          montantTotalComptant: response?.montantTotalComptant ?? this.total(ventes.filter(v => !v.estCredit)),
          montantTotalCredit: response?.montantTotalCredit ?? this.total(ventes.filter(v => v.estCredit))
        };
      }),
      catchError(error => this.handleError(error, 'récupérer les ventes du jour'))
    );
  }

  getVentesParPeriode(dateDebut: string, dateFin: string): Observable<VenteMap[]> {
    const params = new HttpParams().set('dateDebut', dateDebut).set('dateFin', dateFin);
    return this.http.get<any>(`${this.apiUrl}/periode`, { params }).pipe(
      map(response => this.mapVenteList(response)),
      catchError(error => this.handleError(error, 'récupérer les ventes par période'))
    );
  }

  getAllCredits(): Observable<VenteMap[]> {
    return this.getVentesCredit();
  }

  getCreditsNonRegles(): Observable<CreditsNonReglesResponse> {
    return this.http.get<any>(`${this.apiUrl}/credits/non-regles`).pipe(
      map(response => {
        const credits = this.mapVenteList(response, 'credits');
        return {
          credits,
          nombreCredits: response?.nombreCredits ?? credits.length,
          montantTotal: response?.montantTotal ?? this.total(credits, 'montantRestant')
        };
      }),
      catchError(error => this.handleError(error, 'récupérer les crédits non réglés'))
    );
  }

  getCreditsEnRetard(): Observable<CreditsNonReglesResponse> {
    return this.http.get<any>(`${this.apiUrl}/credits/en-retard`).pipe(
      map(response => {
        const credits = this.mapVenteList(response, 'credits');
        return {
          credits,
          nombreCredits: response?.nombreCredits ?? credits.length,
          montantTotal: response?.montantTotal ?? this.total(credits, 'montantRestant')
        };
      }),
      catchError(error => this.handleError(error, 'récupérer les crédits en retard'))
    );
  }

  enregistrerReglementCredit(request: ReglementCreditRequest): Observable<VenteMap> {
    if (request.venteId) {
      return this.http.post<any>(`${this.apiUrl}/credits/${request.venteId}/reglement`, request).pipe(
        map(response => this.mapVente(response)),
        catchError(error => this.handleError(error, 'enregistrer le règlement'))
      );
    }

    return this.http.post<any>(`${this.apiUrl}/credits/reglement`, request).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'enregistrer le règlement'))
    );
  }

  appliquerRemiseGlobale(venteId: number, remise: number, type: RemiseType): Observable<VenteMap> {
    const params = new HttpParams().set('remise', remise).set('type', type);
    return this.http.post<any>(`${this.apiUrl}/${venteId}/remise-globale`, null, { params }).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'appliquer la remise globale'))
    );
  }

  annulerRemiseGlobale(venteId: number): Observable<VenteMap> {
    return this.http.delete<any>(`${this.apiUrl}/${venteId}/remise-globale`).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'annuler la remise globale'))
    );
  }

  modifierLignesVente(venteId: number, lignes: LigneVenteRequest[], motif?: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${venteId}/modifier-lignes`, { lignes, motif }).pipe(
      catchError(error => this.handleError(error, 'modifier les lignes de vente'))
    );
  }

  annulerVente(venteId: number, motif?: string): Observable<VenteMap> {
    return this.http.post<any>(`${this.apiUrl}/${venteId}/annuler`, { motif: motif || 'Annulation mobile' }).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'annuler la vente'))
    );
  }

  annulerVenteCredit(venteId: number, motif?: string): Observable<VenteMap> {
    const params = motif ? new HttpParams().set('motif', motif) : undefined;
    return this.http.post<any>(`${this.apiUrl}/credits/${venteId}/annuler`, null, { params }).pipe(
      map(response => this.mapVente(response)),
      catchError(error => this.handleError(error, 'annuler le crédit'))
    );
  }

  supprimerVenteCredit(venteId: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/credits/${venteId}`).pipe(
      map(() => undefined),
      catchError(error => this.handleError(error, 'supprimer le crédit'))
    );
  }

  effectuerRetourVente(request: RetourVenteRequest): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/retours-ventes`, request).pipe(
      catchError(error => this.handleError(error, 'effectuer le retour de vente'))
    );
  }

  supprimerVente(venteId: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${venteId}`).pipe(
      map(() => undefined),
      catchError(error => this.handleError(error, 'supprimer la vente'))
    );
  }

  imprimerFacture(vente: VenteMap): void {
    const win = window.open('', '_blank');
    if (!win) throw new Error('Impossible d’ouvrir la fenêtre d’impression');
    win.document.write(this.buildFactureHtml(vente));
    win.document.close();
    win.onload = () => setTimeout(() => {
      win.focus();
      win.print();
      win.addEventListener('afterprint', () => win.close());
    }, 300);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  formatDate(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getModePaiementLabel(mode: string): string {
    const labels: Record<string, string> = {
      ESPECES: 'Espèces',
      ORANGE_MONEY: 'Orange Money',
      MOOV_MONEY: 'Moov Money',
      CARTE_BANCAIRE: 'Carte bancaire',
      VIREMENT: 'Virement'
    };
    return labels[mode] || mode;
  }

  calculerPrixApresRemise(prix: number, remisePourcentage?: number | null, remiseMontant?: number | null): number {
    if (remisePourcentage && remisePourcentage > 0) return Math.max(0, prix - (prix * remisePourcentage / 100));
    if (remiseMontant && remiseMontant > 0) return Math.max(0, prix - remiseMontant);
    return prix;
  }

  calculerMontantRemise(prix: number, quantite: number, remisePourcentage?: number | null, remiseMontant?: number | null): number {
    return (prix - this.calculerPrixApresRemise(prix, remisePourcentage, remiseMontant)) * quantite;
  }

  isCreditEnRetard(vente: VenteMap): boolean {
    if (!vente.estCredit || !vente.dateEcheance || vente.creditRegle) return false;
    return new Date(vente.dateEcheance) < new Date();
  }

  private cleanVente(vente: VenteRequest): VenteRequest {
    return {
      ...vente,
      lignes: vente.lignes.map(line => ({
        produitId: line.produitId,
        quantite: Number(line.quantite),
        prixUnitaire: line.prixUnitaire ?? null,
        remisePourcentage: line.remisePourcentage ?? null,
        remiseMontant: line.remiseMontant ?? null
      }))
    };
  }

  private mapVenteList(response: any, primaryKey = 'ventes'): VenteMap[] {
    const items = Array.isArray(response)
      ? response
      : response?.[primaryKey] || response?.data || response?.content || [];

    return Array.isArray(items) ? items.map((item: any) => this.mapVente(item)) : [];
  }

  private mapVente(response: any): VenteMap {
    const data = this.unwrap(response);
    const lines = this.mapLignes(data);
    const montantTotal = Number(data?.montantTotal ?? data?.montantApresRemise ?? 0);

    return {
      id: Number(data?.id || 0),
      numeroVente: data?.numeroVente || data?.numero || '',
      vendeurId: Number(data?.vendeurId || 0),
      vendeurNom: data?.vendeurNom || data?.vendeur?.nomComplet || '',
      montantTotal,
      montantRemiseTotal: Number(data?.montantRemiseTotal || 0),
      montantApresRemise: Number(data?.montantApresRemise ?? montantTotal),
      modePaiement: data?.modePaiement || '',
      referencePaiement: data?.referencePaiement || '',
      dateVente: data?.dateVente || data?.dateCreation || new Date().toISOString(),
      nombreProduits: lines.length,
      lignes: lines,
      produits: lines,
      estCredit: !!data?.estCredit,
      clientId: data?.clientId,
      clientNom: data?.clientNom || data?.client?.nom || '',
      clientPrenom: data?.clientPrenom || data?.client?.prenom || '',
      clientTelephone: data?.clientTelephone || data?.client?.numeroTelephone || '',
      dateEcheance: data?.dateEcheance || '',
      montantVerse: Number(data?.montantVerse || 0),
      montantRestant: Number(data?.montantRestant ?? (data?.estCredit ? montantTotal : 0)),
      creditRegle: !!data?.creditRegle,
      annulee: !!data?.annulee
    };
  }

  private mapLignes(data: any): LigneVenteDto[] {
    const lines = data?.lignes || data?.produits || data?.items || [];
    if (!Array.isArray(lines)) return [];

    return lines.map((line: any) => {
      const product = line.produit || {};
      const quantite = Number(line.quantite || 0);
      const prixUnitaire = Number(line.prixUnitaire ?? line.prixVente ?? product.prixVente ?? 0);
      const sousTotal = Number(line.sousTotal ?? quantite * prixUnitaire);

      return {
        produitId: Number(line.produitId ?? product.id ?? 0),
        produitNom: line.produitNom || product.nom || line.nom || 'Produit',
        quantite,
        prixUnitaire,
        prixAchat: Number(line.prixAchat ?? product.prixAchat ?? 0),
        remisePourcentage: Number(line.remisePourcentage || 0),
        remiseMontant: Number(line.remiseMontant || 0),
        prixApresRemise: Number(line.prixApresRemise || prixUnitaire),
        sousTotal
      };
    });
  }

  private unwrap(response: any): any {
    return response?.vente || response?.venteDto || response?.credit || response?.data || response || {};
  }

  private total(items: VenteMap[], field: keyof VenteMap = 'montantTotal'): number {
    return items.reduce((sum, item) => sum + Number(item[field] || 0), 0);
  }

  private buildFactureHtml(vente: VenteMap): string {
    const b = this.boutiqueService.getInfo();
    const rawLogo = b.logoUrl || (b as any).logoPath || '';
    const makeAbsolute = (url: string): string => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      if (url.startsWith('data:')) return url;
      return `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`;
    };
    const absoluteLogo = makeAbsolute(rawLogo);
    const logoHtml = absoluteLogo
      ? `<img src="${absoluteLogo}" alt="Logo" style="height:70px;max-width:200px;margin-bottom:8px;object-fit:contain" crossorigin="anonymous" onerror="this.style.display='none'">`
      : `<div style="width:64px;height:64px;background:#1a56db;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;color:white;font-size:28px;font-weight:800;margin-bottom:8px">${(b.nom || 'B')[0].toUpperCase()}</div>`;
    const adresseLigne = [b.adresse, b.ville, b.pays].filter(Boolean).join(', ');

    const rows = vente.produits.map(item => `
      <tr>
        <td>${item.produitNom}</td>
        <td style="text-align:center">${item.quantite}</td>
        <td style="text-align:right">${this.formatPrice(item.prixUnitaire)}</td>
        <td style="text-align:center">${item.remisePourcentage ? item.remisePourcentage + '%'
          : item.remiseMontant ? this.formatPrice(item.remiseMontant) : '-'}</td>
        <td style="text-align:right"><strong>${this.formatPrice(item.sousTotal)}</strong></td>
      </tr>`).join('');

    const sousTotal = (vente.montantTotal || 0) + (vente.montantRemiseTotal || 0);

    return `<!doctype html><html><head><meta charset="utf-8">
      <title>Facture ${vente.numeroVente}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Arial,sans-serif;margin:0;padding:24px;color:#1e293b;font-size:13px}
        .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1a56db;padding-bottom:16px;margin-bottom:20px}
        .brand{text-align:left}
        .brand h1{color:#1a56db;font-size:22px;margin:0 0 4px}
        .brand p{margin:2px 0;color:#64748b;font-size:11px}
        .facture-info{text-align:right}
        .facture-info h2{color:#1a56db;margin:0 0 4px;font-size:18px}
        .facture-info p{margin:2px 0;color:#64748b;font-size:11px}
        .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
        .partie{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
        .partie h3{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8}
        .partie p{margin:3px 0;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        thead tr{background:#1a56db;color:white}
        th{padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase}
        td{padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px}
        tbody tr:hover{background:#f8fafc}
        .totaux{margin-left:auto;width:260px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
        .totaux div{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
        .totaux .grand-total{border-top:2px solid #1a56db;margin-top:6px;padding-top:8px;font-size:16px;font-weight:700;color:#1a56db}
        .credit-info{background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-top:16px}
        .credit-info h3{color:#d97706;margin:0 0 6px;font-size:12px}
        .footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:12px;font-size:11px;color:#94a3b8;text-align:center}
        .btn-print{margin-top:16px;padding:10px 20px;background:#1a56db;color:white;border:0;border-radius:6px;cursor:pointer;font-size:13px}
        .btn-close-print{margin-top:16px;margin-left:10px;padding:10px 20px;background:#ef4444;color:white;border:0;border-radius:6px;cursor:pointer;font-size:13px}
        @media print{.btn-print{display:none}.btn-close-print{display:none}.header{-webkit-print-color-adjust:exact;print-color-adjust:exact}thead tr{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head>
      <body>
        <div class="header">
          <div class="brand">
            ${logoHtml}
            <h1>${b.nom || 'Boutique'}</h1>
            ${adresseLigne ? `<p>${adresseLigne}</p>` : ''}
            ${b.telephone ? `<p>Tél: ${b.telephone}</p>` : ''}
            ${b.email ? `<p>${b.email}</p>` : ''}
            ${b.numeroRc ? `<p>RC: ${b.numeroRc}</p>` : ''}
            ${b.numeroIfu ? `<p>IFU: ${b.numeroIfu}</p>` : ''}
          </div>
          <div class="facture-info">
            <h2>FACTURE</h2>
            <p>N° <strong>${vente.numeroVente}</strong></p>
            <p>Date: <strong>${this.formatDate(vente.dateVente)}</strong></p>
            <p>Vendeur: <strong>${vente.vendeurNom || '-'}</strong></p>
          </div>
        </div>

        <div class="parties" style="grid-template-columns:1fr">
          <div class="partie">
            <h3>Facturé à</h3>
            <p><strong>${vente.clientNom || 'Client divers'} ${vente.clientPrenom || ''}</strong></p>
            ${vente.clientTelephone ? `<p>Tél: ${vente.clientTelephone}</p>` : ''}
            ${vente.estCredit && vente.dateEcheance ? `<p>Échéance: ${this.formatDate(vente.dateEcheance)}</p>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th style="text-align:center">Qté</th>
              <th style="text-align:right">Prix unit.</th>
              <th style="text-align:center">Remise</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="totaux">
          ${sousTotal !== vente.montantTotal ? `<div><span>Sous-total</span><span>${this.formatPrice(sousTotal)}</span></div>` : ''}
          ${vente.montantRemiseTotal > 0 ? `<div style="color:#dc2626"><span>Remise</span><span>-${this.formatPrice(vente.montantRemiseTotal)}</span></div>` : ''}
          <div class="grand-total"><span>TOTAL</span><span>${this.formatPrice(vente.montantTotal)}</span></div>
          ${vente.estCredit && !vente.creditRegle ? `
            <div style="color:#0e9f6e"><span>Versé</span><span>${this.formatPrice(vente.montantVerse || 0)}</span></div>
            <div style="color:#d97706;font-weight:700"><span>Reste à payer</span><span>${this.formatPrice(vente.montantRestant || 0)}</span></div>
          ` : ''}
        </div>

        ${vente.estCredit ? `
        <div class="credit-info">
          <h3>VENTE À CRÉDIT</h3>
          <p>Mode: ${this.getModePaiementLabel(vente.modePaiement)} ${vente.referencePaiement ? '· Réf: ' + vente.referencePaiement : ''}</p>
          <p>Statut: <strong>${vente.creditRegle ? 'Réglé intégralement' : 'En cours de règlement'}</strong></p>
        </div>` : ''}

        <div class="footer">
          <p>Merci pour votre confiance · ${b.nom || 'Boutique'}${b.adresse ? ' · ' + b.adresse : ''}</p>
          <p>Document généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        <button class="btn-print" onclick="window.print()">🖨 Imprimer / Enregistrer PDF</button>
        <button class="btn-close-print" onclick="window.close()">✕ Fermer</button>
        <script>window.addEventListener('afterprint',function(){window.close();});<\/script>
      </body></html>`;
  }

  private handleError(error: any, context: string): Observable<never> {
    let message = `Impossible de ${context}`;
    if (error.status === 0) message = 'Impossible de se connecter au serveur';
    if (error.status === 409) message = error.error?.message || 'Stock insuffisant';
    if (error.error?.message) message = error.error.message;
    if (typeof error.error === 'string') message = error.error;
    return throwError(() => new Error(message));
  }
}
