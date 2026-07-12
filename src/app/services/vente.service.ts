import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BoutiqueService } from './boutique.service';
import { FactureDesignService } from './facture-design.service';

export enum ModePaiement {
  ESPECES = 'ESPECES',
  ORANGE_MONEY = 'ORANGE_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
  WAVE_MONEY = 'WAVE_MONEY',
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
  dateReglement?: string;
  regleParNom?: string;
  regleParId?: number;
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

  constructor(private http: HttpClient, private boutiqueService: BoutiqueService, private designService: FactureDesignService) {}

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

    this.openOverlay(html, true);
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
      catchError(() => this.getAllVentes())
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

  getCreditsActifs(boutiqueId: number): Observable<VenteMap[]> {
    return this.http.get<any>(`${this.apiUrl}/${boutiqueId}/credits-actifs`).pipe(
      map(response => this.mapVenteList(response)),
      catchError(error => this.handleError(error, 'récupérer les crédits actifs'))
    );
  }

  getVentesAnnulees(boutiqueId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${boutiqueId}/annulees`).pipe(
      map(response => Array.isArray(response) ? response : (response as any)?.content || []),
      catchError(error => this.handleError(error, 'récupérer les ventes annulées'))
    );
  }

  imprimerFacture(vente: VenteMap): void {
    this.openOverlay(this.buildFactureHtml(vente), true);
  }

  ouvrirFacture(vente: VenteMap): void {
    this.openOverlay(this.buildFactureHtml(vente), false);
  }

  private openOverlay(html: string, autoprint: boolean): void {
    document.getElementById('inv-overlay-root')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'inv-overlay-root';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:rgba(0,0,0,.65)';
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#1a56db;padding:10px 16px;display:flex;gap:10px;align-items:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    bar.innerHTML = `
      <button onclick="document.getElementById('inv-overlay-root').remove()" style="background:#ef4444;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:14px;font-weight:700;cursor:pointer">✕ Fermer</button>
      <button onclick="document.getElementById('inv-frame-root').contentWindow.print()" style="background:#fff;color:#1a56db;border:none;border-radius:8px;padding:9px 20px;font-size:14px;font-weight:700;cursor:pointer">🖨 Imprimer / PDF</button>
    `;
    const frame = document.createElement('iframe');
    frame.id = 'inv-frame-root';
    frame.style.cssText = 'flex:1;width:100%;border:none;background:#f8fafc';
    frame.setAttribute('srcdoc', html);
    overlay.appendChild(bar);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
    if (autoprint) {
      frame.addEventListener('load', () => setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      }, 400));
    }
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
      WAVE_MONEY: 'Wave',
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
    const design = this.designService.getDesign();
    const shop = this.boutiqueService.getInfo();
    const nom   = shop.nom || 'Ges Lafia';
    const adr   = shop.adresse || '';
    const ville = shop.ville || '';
    const tel   = shop.telephone || '';
    const email = shop.email || '';
    const rc    = shop.numeroRc || '';
    const ifu   = shop.numeroIfu || '';

    const rawLogo = shop.logoUrl || (shop as any).logoPath || '';
    let logoAbsUrl = '';
    if (rawLogo) {
      logoAbsUrl = rawLogo.startsWith('http') ? rawLogo : `${window.location.origin}${rawLogo.startsWith('/') ? '' : '/'}${rawLogo}`;
    }
    const initial = (nom.charAt(0) || 'B').toUpperCase();
    const logoBlock = logoAbsUrl
      ? `<img src="${logoAbsUrl}" alt="${nom}" class="inv-logo-img" onerror="this.style.display='none';document.getElementById('inv-logo-fb').style.display='flex'">
         <div id="inv-logo-fb" class="inv-logo-fallback" style="display:none">${initial}</div>`
      : `<div class="inv-logo-fallback">${initial}</div>`;

    const lignes = vente.produits || vente.lignes || [];
    const rows = lignes.map((item: any, i: number) => {
      const remise = item.remisePourcentage ? `${item.remisePourcentage}%`
        : item.remiseMontant ? this.formatPrice(item.remiseMontant) : '—';
      return `<tr class="${i % 2 === 0 ? 'even' : ''}">
        <td class="td-name">${item.produitNom || item.designation || 'Produit'}</td>
        <td class="td-center">${item.quantite}</td>
        <td class="td-right">${this.formatPrice(item.prixUnitaire)}</td>
        <td class="td-center td-remise">${remise}</td>
        <td class="td-right td-bold">${this.formatPrice(item.sousTotal ?? (item.quantite * item.prixUnitaire))}</td>
      </tr>`;
    }).join('');

    const sousTotal = (vente.montantTotal || 0) + (vente.montantRemiseTotal || 0);
    const hasRemise = vente.montantRemiseTotal > 0;
    const totauxRows = `
      <tr class="subtotal-row">
        <td colspan="4" class="td-right td-light">Sous-total</td>
        <td class="td-right">${this.formatPrice(sousTotal)}</td>
      </tr>
      ${hasRemise ? `<tr class="subtotal-row"><td colspan="4" class="td-right td-light">Remise</td>
        <td class="td-right td-red">- ${this.formatPrice(vente.montantRemiseTotal)}</td></tr>` : ''}
      <tr class="total-row">
        <td colspan="4" class="td-right td-total-label">TOTAL À PAYER</td>
        <td class="td-right td-total-val">${this.formatPrice(vente.montantApresRemise || vente.montantTotal)}</td>
      </tr>
      ${vente.estCredit && !vente.creditRegle ? `
      <tr class="subtotal-row"><td colspan="4" class="td-right" style="color:#0e9f6e">Versé</td>
        <td class="td-right" style="color:#0e9f6e;font-weight:700">${this.formatPrice(vente.montantVerse || 0)}</td></tr>
      <tr class="subtotal-row"><td colspan="4" class="td-right" style="color:#d97706">Reste à payer</td>
        <td class="td-right" style="color:#d97706;font-weight:800">${this.formatPrice(vente.montantRestant || 0)}</td></tr>
      ` : ''}`;

    const qrUrl = `${environment.apiUrl}/ventes/${vente.id}/qrcode`;
    const qrBlock = `<div style="margin-top:10px;text-align:center">
      <img src="${qrUrl}" width="72" height="72" style="border-radius:6px;background:#fff;padding:3px" alt="QR" onerror="this.style.display='none'">
      <p style="font-size:9px;margin-top:2px;opacity:.65">Scanner pour vérifier</p>
    </div>`;

    // ── Couleurs selon design ──
    const p1 = design === 2 ? '#0f172a' : design === 3 ? '#18181b' : '#081648';
    const p2 = design === 2 ? '#1e293b' : design === 3 ? '#3f3f46' : '#1a56db';
    const acc = design === 2 ? '#f59e0b' : design === 3 ? '#18181b' : '#1a56db';
    const accLight = design === 2 ? '#fef3c7' : design === 3 ? '#f4f4f5' : '#eff6ff';
    const headerGrad = design === 2
      ? `background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);`
      : design === 3 ? `background:#ffffff;border-bottom:3px solid #18181b;`
      : `background:linear-gradient(135deg,#081648 0%,#0d2b85 50%,#1a56db 100%);`;
    const headerTextColor = design === 3 ? '#18181b' : '#ffffff';
    const headerSubColor  = design === 3 ? '#52525b' : design === 2 ? '#94a3b8' : 'rgba(255,255,255,0.60)';
    const logoFallbackBg  = design === 3 ? '#e4e4e7' : 'rgba(255,255,255,0.15)';
    const logoFallbackColor = design === 3 ? '#18181b' : '#ffffff';
    const numColor = design === 2 ? '#fbbf24' : design === 3 ? '#52525b' : '#93c5fd';
    const footerGrad = design === 2
      ? `background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);`
      : design === 3 ? `background:#18181b;`
      : `background:linear-gradient(135deg,#081648 0%,#0d2b85 100%);`;
    const tblHead = design === 2 ? `background:linear-gradient(135deg,#0f172a,#1e293b);`
      : design === 3 ? `background:#18181b;`
      : `background:linear-gradient(135deg,#081648,#1a56db);`;
    const btnPrint = design === 2 ? `background:linear-gradient(135deg,#0f172a,#f59e0b);`
      : design === 3 ? `background:#18181b;`
      : `background:linear-gradient(135deg,#081648,#1a56db);`;

    const creditBadge = vente.estCredit ? `
      <div style="margin-top:12px;padding:10px 16px;background:rgba(217,119,6,.12);border:1.5px solid rgba(217,119,6,.4);border-radius:8px;color:${headerTextColor}">
        <div style="font-size:10px;font-weight:800;letter-spacing:.6px;margin-bottom:4px;color:${numColor}">VENTE À CRÉDIT</div>
        <div style="font-size:12px;opacity:.85">Mode : ${this.getModePaiementLabel(vente.modePaiement)}${vente.referencePaiement ? ' · Réf : ' + vente.referencePaiement : ''}</div>
        ${vente.dateEcheance ? `<div style="font-size:12px;opacity:.85">Échéance : ${this.formatDate(vente.dateEcheance)}</div>` : ''}
        <div style="font-size:12px;font-weight:700;margin-top:4px">${vente.creditRegle ? '✓ Réglé' : 'En cours de règlement'}</div>
      </div>` : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Facture ${vente.numeroVente} — ${nom}</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#f8fafc;padding:32px 24px;font-size:13px;line-height:1.5}
    .invoice-sheet{background:#fff;border-radius:16px;box-shadow:0 4px 32px rgba(8,22,72,.10);max-width:820px;margin:0 auto;overflow:hidden}
    .inv-header{${headerGrad}padding:28px 32px 24px;display:flex;align-items:flex-start;justify-content:space-between;gap:24px}
    .inv-brand{display:flex;align-items:center;gap:14px}
    .inv-logo{flex-shrink:0;display:flex;align-items:center;justify-content:center}
    .inv-logo-img{width:72px;height:72px;object-fit:contain;border-radius:12px;border:1.5px solid rgba(128,128,128,.3)}
    .inv-logo-fallback{width:64px;height:64px;border-radius:16px;background:${logoFallbackBg};border:2px solid rgba(128,128,128,.25);display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:${logoFallbackColor};flex-shrink:0}
    .inv-brand-text{color:${headerTextColor}}
    .inv-brand-name{font-size:22px;font-weight:900;letter-spacing:.5px;margin-bottom:3px}
    .inv-brand-sub{font-size:12px;color:${headerSubColor};letter-spacing:.4px}
    .inv-brand-contact{margin-top:8px;font-size:11.5px;color:${headerSubColor};line-height:1.7}
    .inv-title-block{text-align:right;color:${headerTextColor}}
    .inv-title{font-size:28px;font-weight:900;letter-spacing:-.5px;text-transform:uppercase;opacity:.9}
    .inv-number{font-size:16px;font-weight:700;color:${numColor};margin-top:4px;letter-spacing:.5px}
    .inv-date{font-size:12px;color:${headerSubColor};margin-top:6px}
    .inv-info{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #f1f5f9}
    .inv-info-block{padding:20px 32px;border-right:1px solid #f1f5f9}
    .inv-info-block:last-child{border-right:none}
    .inv-info-label{font-size:10px;font-weight:800;color:${acc};text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px}
    .inv-info-name{font-size:15px;font-weight:700;color:#0f172a;margin-bottom:4px}
    .inv-info-detail{font-size:12.5px;color:#64748b;line-height:1.7}
    .inv-table-wrap{overflow:hidden}
    table{width:100%;border-collapse:collapse}
    thead tr{${tblHead}color:#fff}
    thead th{padding:11px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px}
    .th-right{text-align:right}.th-center{text-align:center}
    tbody tr.even{background:#f8fafc}
    td{padding:10px 16px;font-size:13px;border-bottom:1px solid #f1f5f9}
    .td-name{font-weight:600;color:#0f172a}.td-center{text-align:center;color:#475569}
    .td-right{text-align:right;color:#475569}.td-bold{font-weight:700;color:#0f172a}
    .td-remise{color:#dc2626;font-weight:600}.td-light{color:#64748b;font-size:12px}.td-red{color:#dc2626;font-weight:700}
    .subtotal-row td{border-bottom:none;padding:6px 16px}
    .total-row{background:${accLight}}
    .total-row td{padding:14px 16px;border-top:2px solid ${acc}}
    .td-total-label{font-size:13px;font-weight:700;color:${acc};text-transform:uppercase;letter-spacing:.5px}
    .td-total-val{font-size:20px;font-weight:900;color:${acc}}
    .inv-footer{${footerGrad}padding:16px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .inv-footer-brand{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.75);font-size:12px}
    .inv-footer-shop-name{font-weight:800;font-size:14px;color:#fff}
    .inv-footer-thank{font-size:12px;color:rgba(255,255,255,.60);font-style:italic}
    @media print{
      @page{size:A4;margin:10mm}
      body{background:white;padding:0;margin:0}
      .invoice-sheet{box-shadow:none;border-radius:0;max-width:100%;margin:0}
    }
  </style>
</head>
<body>
<div class="invoice-sheet">
  <div class="inv-header">
    <div class="inv-brand">
      <div class="inv-logo">${logoBlock}</div>
      <div class="inv-brand-text">
        <p class="inv-brand-name">${nom}</p>
        <p class="inv-brand-sub">${shop.description || ville || 'Gestion de boutique'}</p>
        <div class="inv-brand-contact">
          ${adr ? `📍 ${adr}${ville ? ', ' + ville : ''}<br>` : ''}
          ${tel ? `📞 ${tel}<br>` : ''}
          ${email ? `✉ ${email}<br>` : ''}
          ${rc ? `RC: ${rc}` : ''}${rc && ifu ? ' · ' : ''}${ifu ? `IFU: ${ifu}` : ''}
        </div>
      </div>
    </div>
    <div class="inv-title-block">
      <p class="inv-title">Facture</p>
      <p class="inv-number">${vente.numeroVente}</p>
      <p class="inv-date">Émise le ${this.formatDate(vente.dateVente)}</p>
      <p class="inv-date">Vendeur : ${vente.vendeurNom || '—'}</p>
      ${qrBlock}
      ${creditBadge}
    </div>
  </div>

  <div class="inv-info">
    <div class="inv-info-block">
      <p class="inv-info-label">Facturé à</p>
      <p class="inv-info-name">${vente.clientNom || 'Client divers'} ${vente.clientPrenom || ''}</p>
      <div class="inv-info-detail">
        ${vente.clientTelephone ? `📞 ${vente.clientTelephone}<br>` : ''}
        ${vente.estCredit && vente.dateEcheance ? `⏰ Échéance : ${this.formatDate(vente.dateEcheance)}` : ''}
        ${!vente.clientTelephone && !vente.dateEcheance ? 'Aucune coordonnée' : ''}
      </div>
    </div>
    <div class="inv-info-block">
      <p class="inv-info-label">Détails vente</p>
      <div class="inv-info-detail">
        <strong>N° :</strong> ${vente.numeroVente}<br>
        <strong>Date :</strong> ${this.formatDate(vente.dateVente)}<br>
        <strong>Mode :</strong> ${this.getModePaiementLabel(vente.modePaiement)}<br>
        ${vente.referencePaiement ? `<strong>Réf :</strong> ${vente.referencePaiement}<br>` : ''}
        <strong>Type :</strong> <span style="font-weight:700;color:${vente.estCredit ? '#d97706' : '#0e9f6e'}">${vente.estCredit ? 'Crédit' : 'Comptant'}</span>
      </div>
    </div>
  </div>

  <div class="inv-table-wrap">
    <table>
      <thead><tr>
        <th>Désignation</th>
        <th class="th-center">Qté</th>
        <th class="th-right">Prix unitaire</th>
        <th class="th-center">Remise</th>
        <th class="th-right">Sous-total</th>
      </tr></thead>
      <tbody>${rows}${totauxRows}</tbody>
    </table>
  </div>

  <div class="inv-footer">
    <div class="inv-footer-brand">
      <span class="inv-footer-shop-name">${nom}</span>
      ${adr || tel ? `<span style="color:rgba(255,255,255,.35);margin:0 6px">·</span><span>${adr}${ville ? ' ' + ville : ''}${tel ? ' — ' + tel : ''}</span>` : ''}
    </div>
    <p class="inv-footer-thank">Merci pour votre confiance !</p>
  </div>
</div>
</body>
</html>`;
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
