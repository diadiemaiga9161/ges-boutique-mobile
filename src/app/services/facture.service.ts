import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BoutiqueService } from './boutique.service';
import { FactureDesignService } from './facture-design.service';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export type FactureStatut = 'BROUILLON' | 'VALIDE' | 'PAYEE' | 'ANNULEE';
export type FactureRemiseType = 'POURCENTAGE' | 'MONTANT_FIXE';

export interface LigneFactureRequest {
  produitId?: number;
  designation?: string;
  description?: string;
  quantite: number;
  prixUnitaire: number;
  remisePourcentage?: number;
  remiseMontant?: number;
}

export interface FactureRequest {
  clientId?: number;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  clientAdresse?: string;
  creerClient?: boolean;
  notes?: string;
  utilisateurId?: number;
  remiseGlobale?: number;
  typeRemiseGlobale?: FactureRemiseType | string;
  lignes: LigneFactureRequest[];
}

export interface LigneFacture extends LigneFactureRequest {
  id?: number;
  produitNom?: string;
  prixAchat?: number;
  prixApresRemise?: number;
  sousTotal?: number;
  montantRemise?: number;
}

export interface Facture {
  id: number;
  numeroFacture: string;
  dateCreation: string;
  clientId?: number;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  clientAdresse?: string;
  lignes: LigneFacture[];
  montantTotal: number;
  montantRemiseTotal: number;
  montantApresRemise: number;
  remiseGlobale: number;
  typeRemiseGlobale?: FactureRemiseType;
  statut: FactureStatut | string;
  venteId?: number;
  utilisateurId?: number;
  utilisateurNom?: string;
  notes?: string;
}

export interface StatistiquesFactures {
  nombreTotal: number;
  nombreBrouillons: number;
  nombreValides: number;
  nombrePayees: number;
  nombreAnnulees: number;
  montantTotal: number;
}

@Injectable({ providedIn: 'root' })
export class FactureService {
  private readonly apiUrl = `${environment.apiUrl}/caisse/factures`;

  constructor(
    private http: HttpClient,
    private boutique: BoutiqueService,
    private designService: FactureDesignService
  ) {}

  creerFacture(request: FactureRequest): Observable<Facture> {
    return this.http.post<any>(this.apiUrl, request).pipe(
      map(response => this.mapFacture(response)),
      catchError(error => this.handleError(error, 'créer la facture'))
    );
  }

  modifierFacture(id: number, request: FactureRequest): Observable<Facture> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request).pipe(
      map(response => this.mapFacture(response)),
      catchError(error => this.handleError(error, 'modifier la facture'))
    );
  }

  supprimerFacture(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => undefined),
      catchError(error => this.handleError(error, 'supprimer la facture'))
    );
  }

  obtenirFacture(id: number): Observable<Facture> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      map(response => this.mapFacture(response)),
      catchError(error => this.handleError(error, 'récupérer la facture'))
    );
  }

  obtenirToutesFactures(): Observable<Facture[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => this.extractList(response).map(item => this.mapFacture(item))),
      catchError(error => this.handleError(error, 'récupérer les factures'))
    );
  }

  obtenirFacturesParStatut(statut: string): Observable<Facture[]> {
    return this.http.get<any>(`${this.apiUrl}/statut/${statut}`).pipe(
      map(response => this.extractList(response).map(item => this.mapFacture(item))),
      catchError(error => this.handleError(error, 'récupérer les factures par statut'))
    );
  }

  obtenirFacturesParClient(clientNom: string): Observable<Facture[]> {
    const params = new HttpParams().set('clientNom', clientNom);
    return this.http.get<any>(`${this.apiUrl}/client`, { params }).pipe(
      map(response => this.extractList(response).map(item => this.mapFacture(item))),
      catchError(error => this.handleError(error, 'récupérer les factures par client'))
    );
  }

  obtenirFacturesParPeriode(dateDebut: string, dateFin: string): Observable<Facture[]> {
    const params = new HttpParams().set('dateDebut', dateDebut).set('dateFin', dateFin);
    return this.http.get<any>(`${this.apiUrl}/periode`, { params }).pipe(
      map(response => this.extractList(response).map(item => this.mapFacture(item))),
      catchError(error => this.handleError(error, 'récupérer les factures par période'))
    );
  }

  obtenirFacturesParVente(venteId: number): Observable<Facture[]> {
    return this.http.get<any>(`${this.apiUrl}/vente/${venteId}`).pipe(
      map(response => this.extractList(response).map(item => this.mapFacture(item))),
      catchError(error => this.handleError(error, 'récupérer les factures par vente'))
    );
  }

  creerFactureDepuisVente(venteId: number, dateFacture: string | null, utilisateurId: number): Observable<Facture> {
    let params = new HttpParams().set('utilisateurId', utilisateurId);
    if (dateFacture) params = params.set('dateFacture', dateFacture);
    return this.http.post<any>(`${this.apiUrl}/depuis-vente/${venteId}`, null, { params }).pipe(
      map(response => this.mapFacture(response)),
      catchError(error => this.handleError(error, 'créer la facture depuis la vente'))
    );
  }

  getStatistiques(): Observable<StatistiquesFactures> {
    return this.http.get<any>(`${this.apiUrl}/statistiques`).pipe(
      map(response => response?.statistiques || response?.data || response),
      catchError(error => this.handleError(error, 'récupérer les statistiques factures'))
    );
  }

  validerFacture(id: number): Observable<Facture> {
    return this.http.put<any>(`${this.apiUrl}/${id}/valider`, {}).pipe(
      map(response => this.mapFacture(response)),
      catchError(error => this.handleError(error, 'valider la facture'))
    );
  }

  annulerFacture(id: number): Observable<Facture> {
    return this.http.put<any>(`${this.apiUrl}/${id}/annuler`, {}).pipe(
      map(response => this.mapFacture(response)),
      catchError(error => this.handleError(error, 'annuler la facture'))
    );
  }

  ouvrirFacture(facture: Facture): void {
    this.openOverlay(this.buildHtml(facture), false, facture);
  }

  imprimerFacture(facture: Facture): void {
    this.openOverlay(this.buildHtml(facture), true, facture);
  }

  async partagerFacture(facture: Facture): Promise<void> {
    const html = this.buildHtml(facture);
    const nom = `Facture_${facture.numeroFacture.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    try {
      const b64 = btoa(unescape(encodeURIComponent(html)));
      const result = await Filesystem.writeFile({
        path: nom,
        data: b64,
        directory: Directory.Cache,
      });
      await Share.share({
        title: `Facture ${facture.numeroFacture}`,
        text: `Facture ${facture.numeroFacture} — ${this.boutique.getInfo().nom || 'Boutique'}`,
        url: result.uri,
        dialogTitle: 'Partager la facture',
      });
    } catch {
      // Fallback : partage texte simple
      const shop = this.boutique.getInfo();
      const total = this.formatPrice(facture.montantApresRemise || facture.montantTotal);
      const client = [facture.clientNom, facture.clientPrenom].filter(Boolean).join(' ') || 'Client divers';
      const text = `🧾 *Facture ${facture.numeroFacture}*\n📅 ${this.formatDate(facture.dateCreation)}\n👤 ${client}\n💰 Total : ${total}\n🏪 ${shop.nom || 'Boutique'}`;
      await Share.share({ title: `Facture ${facture.numeroFacture}`, text, dialogTitle: 'Partager' }).catch(() => {});
    }
  }

  protected openOverlay(html: string, autoprint: boolean, facture?: Facture): void {
    document.getElementById('inv-overlay-root')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'inv-overlay-root';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:rgba(0,0,0,.65)';

    // Bouton × flottant en haut à droite — toujours accessible même si barre d'état masque le haut
    const btnFloat = document.createElement('button');
    btnFloat.textContent = '✕';
    btnFloat.style.cssText = 'position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:12px;background:rgba(0,0,0,.75);color:#fff;border:none;border-radius:50%;width:44px;height:44px;font-size:20px;font-weight:700;cursor:pointer;z-index:2;line-height:1';
    btnFloat.addEventListener('click', () => overlay.remove());
    overlay.appendChild(btnFloat);

    const frame = document.createElement('iframe');
    frame.id = 'inv-frame-root';
    frame.style.cssText = 'flex:1;width:100%;border:none;background:#f8fafc';
    frame.setAttribute('srcdoc', html);

    // Barre EN BAS — évite la barre d'état Android/iOS qui masque le haut sur mobile
    const bar = document.createElement('div');
    bar.style.cssText = 'background:#1a56db;padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;flex-shrink:0;box-shadow:0 -2px 8px rgba(0,0,0,.3);flex-wrap:wrap';

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

    if (facture) {
      const btnShare = document.createElement('button');
      btnShare.textContent = '📤 Partager';
      btnShare.style.cssText = 'background:#25D366;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
      btnShare.addEventListener('click', () => this.partagerFacture(facture));
      bar.appendChild(btnShare);
    }

    // iframe d'abord, barre de boutons en bas
    overlay.appendChild(frame);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);

    if (autoprint) {
      frame.addEventListener('load', () => setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      }, 400));
    }
  }

  genererHTMLDocument(config: {
    titre: string;
    sousTitre?: string;
    colonnes: string[];
    lignes: string[][];
    totaux?: string[];
    pied?: string;
  }): string {
    const design = this.designService.getDesign();
    const couleur = design === 2 ? '#b8860b' : design === 3 ? '#1a1a1a' : '#1a56db';
    const fond = design === 2 ? '#1a1a2e' : design === 3 ? '#f8f8f8' : '#1e3a5f';

    const entetes = config.colonnes.map(c => `<th style="background:${couleur};color:#fff;padding:8px;text-align:left;border:1px solid #ddd">${c}</th>`).join('');
    const lignes = config.lignes.map((row, i) =>
      `<tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">${row.map(cell => `<td style="padding:7px 8px;border:1px solid #eee;font-size:12px">${cell}</td>`).join('')}</tr>`
    ).join('');
    const totaux = config.totaux?.map(t => `<div style="text-align:right;font-weight:600;font-size:13px;padding:4px 0">${t}</div>`).join('') || '';
    const pied = config.pied ? `<p style="font-size:11px;color:#888;margin-top:16px;text-align:center">${config.pied}</p>` : '';

    return `<!doctype html><html><head><meta charset="utf-8"><title>${config.titre}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#f0f4f8}
      .doc{background:#fff;border-radius:8px;padding:24px;max-width:900px;margin:0 auto;box-shadow:0 2px 12px rgba(0,0,0,.08)}
      .header{background:${fond};color:#fff;padding:16px 24px;border-radius:6px;margin-bottom:20px}
      .header h1{margin:0;font-size:20px;color:${couleur}}
      .header p{margin:4px 0 0;font-size:12px;opacity:.85}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      .totaux{margin-top:14px;border-top:2px solid ${couleur};padding-top:10px}
      .btn-bar{display:flex;gap:8px;margin-bottom:16px}
      .btn-print{background:${couleur};color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}
      .btn-close{background:#ef4444;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}
      @media print{.btn-bar{display:none}body{background:#fff;padding:0}.doc{box-shadow:none}}
    </style></head><body>
    <div class="doc">
      <div class="btn-bar">
        <button class="btn-print" onclick="window.print()">🖨 Imprimer / PDF</button>
        <button class="btn-close" onclick="window.close()">✕ Fermer</button>
      </div>
      <div class="header">
        <h1>${config.titre}</h1>
        ${config.sousTitre ? `<p>${config.sousTitre}</p>` : ''}
      </div>
      <table>
        <thead><tr>${entetes}</tr></thead>
        <tbody>${lignes}</tbody>
      </table>
      <div class="totaux">${totaux}</div>
      ${pied}
      <p style="font-size:11px;color:#aaa;text-align:right;margin-top:12px">Généré le ${new Date().toLocaleDateString('fr-FR')} · Ges-Boutique</p>
    </div>
    <script>window.addEventListener('afterprint',function(){window.close();});<\/script>
    </body></html>`;
  }

  ouvrirDocumentPDF(config: {
    titre: string;
    sousTitre?: string;
    colonnes: string[];
    lignes: string[][];
    totaux?: string[];
    pied?: string;
  }): void {
    this.openOverlay(this.genererHTMLDocument(config), false);
  }

  formatPrice(value: number): string {
    const n = Math.round(value || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
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

  getStatutText(statut: string): string {
    const map: Record<string, string> = {
      BROUILLON: 'Brouillon',
      VALIDE: 'Validée',
      PAYEE: 'Payée',
      ANNULEE: 'Annulée'
    };
    return map[statut] || statut;
  }

  isFactureModifiable(facture: Facture): boolean {
    return facture.statut === 'BROUILLON';
  }

  private mapFacture(response: any): Facture {
    const data = response?.facture || response?.data || response || {};
    return {
      id: Number(data.id || 0),
      numeroFacture: data.numeroFacture || '',
      dateCreation: data.dateCreation || new Date().toISOString(),
      clientId: data.clientId ?? data.client?.id,
      clientNom: data.clientNom ?? data.client?.nom ?? '',
      clientPrenom: data.clientPrenom ?? data.client?.prenom ?? '',
      clientTelephone: data.clientTelephone ?? data.client?.numeroTelephone ?? '',
      clientAdresse: data.clientAdresse ?? data.client?.adresse ?? '',
      lignes: Array.isArray(data.lignes) ? data.lignes.map((l: any) => ({
        ...l,
        produitId: l.produitId ?? l.produit?.id,
        produitNom: l.produitNom ?? l.produit?.nom,
      })) : [],
      montantTotal: Number(data.montantTotal || 0),
      montantRemiseTotal: Number(data.montantRemiseTotal || 0),
      montantApresRemise: Number(data.montantApresRemise || data.montantTotal || 0),
      remiseGlobale: Number(data.remiseGlobale || 0),
      typeRemiseGlobale: data.typeRemiseGlobale,
      statut: data.statut || 'BROUILLON',
      venteId: data.venteId,
      utilisateurId: data.utilisateurId,
      utilisateurNom: data.utilisateurNom,
      notes: data.notes || ''
    };
  }

  private extractList(response: any): any[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.factures)) return response.factures;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.content)) return response.content;
    return [];
  }

  ouvrirRecuPaiementFournisseur(paiement: any, fournisseur: any): void {
    const shop = this.boutique.getInfo();
    const nomBoutique = shop.nom || 'Ges Boutique';
    const datePai = paiement.datePaiement
      ? new Date(paiement.datePaiement).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR');
    const qrData = encodeURIComponent(
      `RECU PAIEMENT FOURNISSEUR\nFournisseur: ${fournisseur.nom}\nDate: ${datePai}\nMontant: ${this.formatPrice(paiement.montant)}\nMode: ${paiement.modePaiement || 'ESPECES'}\nRef: ${paiement.reference || '-'}\nBoutique: ${nomBoutique}`
    );
    const rows: [string, string][] = [
      ['Mode de paiement', paiement.modePaiement || 'ESPECES'],
      ...(paiement.reference ? [['Référence', paiement.reference] as [string, string]] : []),
      ...(paiement.observation ? [['Observation', paiement.observation] as [string, string]] : []),
    ];
    const html = this.buildHtmlRecu({
      type: 'PAIEMENT FOURNISSEUR', numero: paiement.id ? `PAI-${paiement.id}` : 'PAI-XXX',
      date: datePai, entite: fournisseur.nom + (fournisseur.code ? ` (${fournisseur.code})` : ''),
      entiteLabel: 'Fournisseur', telephone: fournisseur.telephone,
      rows, montant: paiement.montant, montantLabel: 'MONTANT PAYÉ',
      boutique: nomBoutique, tel: shop.telephone || '', adr: shop.adresse || '', qrData
    });
    this.openOverlay(html, false);
  }

  ouvrirRecuReglementCredit(reglement: any, client: any): void {
    const shop = this.boutique.getInfo();
    const nomBoutique = shop.nom || 'Ges Boutique';
    const dateReg = reglement.datePaiement
      ? new Date(reglement.datePaiement).toLocaleDateString('fr-FR')
      : new Date().toLocaleDateString('fr-FR');
    const clientNom = [client?.prenom, client?.nom].filter(Boolean).join(' ') || client?.nom || 'Client';
    const qrData = encodeURIComponent(
      `RECU REGLEMENT CREDIT\nClient: ${clientNom}\nDate: ${dateReg}\nMontant: ${this.formatPrice(reglement.montant)}\nMode: ${reglement.modePaiement || 'ESPECES'}\nBoutique: ${nomBoutique}`
    );
    const rows: [string, string][] = [
      ['Mode de paiement', reglement.modePaiement || 'ESPECES'],
      ...(reglement.montantRestant != null ? [['Reste dû', this.formatPrice(reglement.montantRestant)] as [string, string]] : []),
    ];
    const html = this.buildHtmlRecu({
      type: 'RÈGLEMENT CRÉDIT', numero: reglement.id ? `REG-${reglement.id}` : 'REG-XXX',
      date: dateReg, entite: clientNom, entiteLabel: 'Client',
      telephone: client?.telephone, rows, montant: reglement.montant, montantLabel: 'MONTANT RÉGLÉ',
      boutique: nomBoutique, tel: shop.telephone || '', adr: shop.adresse || '', qrData
    });
    this.openOverlay(html, false);
  }

  private buildHtmlRecu(c: {
    type: string; numero: string; date: string; entite: string; entiteLabel: string;
    telephone?: string; rows: [string, string][]; montant: number; montantLabel: string;
    boutique: string; tel: string; adr: string; qrData: string;
  }): string {
    const design = this.designService.getDesign();
    const acc = design === 2 ? '#f59e0b' : design === 3 ? '#18181b' : '#1a56db';
    const hdrGrad = design === 2
      ? 'linear-gradient(135deg,#0f172a,#1e293b)'
      : design === 3 ? '#18181b'
      : 'linear-gradient(135deg,#081648,#1a56db)';
    const rowsHtml = c.rows.map(([l, v]) =>
      `<div class="r"><span class="rl">${l}</span><span class="rv">${v}</span></div>`
    ).join('');
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${c.type} — ${c.numero}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:24px;font-size:13px}
.sheet{background:#fff;max-width:520px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(8,22,72,.12)}
.hdr{background:${hdrGrad};color:#fff;padding:28px 24px;text-align:center}
.hdr-type{font-size:11px;letter-spacing:3px;opacity:.7;text-transform:uppercase;margin-bottom:6px}
.hdr-title{font-size:24px;font-weight:900;letter-spacing:1px}
.hdr-num{font-size:12px;opacity:.65;margin-top:6px}
.body{padding:24px}
.section{margin-bottom:18px}
.section-title{font-size:10px;letter-spacing:2px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px}
.entity{font-size:17px;font-weight:700;color:#1e293b}
.entity-sub{font-size:12px;color:#64748b;margin-top:2px}
.r{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f1f5f9}
.rl{color:#64748b;font-size:12px}
.rv{font-weight:600;color:#1e293b;font-size:12px}
.total-box{background:#eff6ff;border:2px solid ${acc};border-radius:10px;padding:18px;text-align:center;margin:18px 0}
.total-lbl{font-size:11px;letter-spacing:2px;color:${acc};text-transform:uppercase;margin-bottom:6px}
.total-val{font-size:32px;font-weight:900;color:${acc}}
.qr-block{text-align:center;padding:12px 0}
.qr-block img{border-radius:8px;border:3px solid #e2e8f0}
.qr-hint{font-size:10px;color:#94a3b8;margin-top:6px}
.ftr{background:${hdrGrad};color:rgba(255,255,255,.6);text-align:center;padding:14px;font-size:11px}
@media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div class="hdr-type">${c.boutique}</div>
    <div class="hdr-title">REÇU</div>
    <div class="hdr-num">${c.type} · ${c.numero} · ${c.date}</div>
  </div>
  <div class="body">
    <div class="section">
      <div class="section-title">${c.entiteLabel}</div>
      <div class="entity">${c.entite}</div>
      ${c.telephone ? `<div class="entity-sub">📞 ${c.telephone}</div>` : ''}
    </div>
    <div class="section">
      <div class="section-title">Détails</div>
      ${rowsHtml}
    </div>
    <div class="total-box">
      <div class="total-lbl">${c.montantLabel}</div>
      <div class="total-val">${this.formatPrice(c.montant)}</div>
    </div>
    <div class="qr-block">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${c.qrData}" width="110" height="110" alt="QR Code" onerror="this.style.display='none'">
      <div class="qr-hint">Scanner pour vérifier ce reçu</div>
    </div>
    ${c.adr || c.tel ? `<div style="text-align:center;color:#94a3b8;font-size:11px">${[c.boutique, c.adr, c.tel].filter(Boolean).join(' · ')}</div>` : ''}
  </div>
  <div class="ftr">Document officiel — Ges Boutique · Généré le ${new Date().toLocaleDateString('fr-FR')}</div>
</div>
</body></html>`;
  }

  private buildHtml(facture: Facture): string {
    const design = this.designService.getDesign(); // 1=Classique, 2=Moderne, 3=Minimaliste
    const shop  = this.boutique.getInfo();
    const nom   = shop.nom   || 'Ges Lafia';
    const adr   = shop.adresse || '';
    const ville = shop.ville  || '';
    const tel   = shop.telephone || '';
    const email = shop.email  || '';
    const rc    = shop.numeroRc  || '';
    const ifu   = shop.numeroIfu || '';

    const statutColor: Record<string, string> = {
      BROUILLON: '#64748b', VALIDE: '#1a56db', PAYEE: '#0e9f6e', ANNULEE: '#dc2626'
    };
    const sc = statutColor[facture.statut] || '#64748b';

    const rawLogo = shop.logoUrl || shop.logoPath || '';
    // Sur Capacitor, seules les URLs absolues HTTP fonctionnent dans l'iframe
    const logoAbsUrl = rawLogo.startsWith('http') ? rawLogo : '';
    const initial = (nom.charAt(0) || 'B').toUpperCase();
    const logoBlock = logoAbsUrl
      ? `<img src="${logoAbsUrl}" alt="${nom}" class="inv-logo-img" onerror="this.style.display='none';document.getElementById('inv-logo-fb').style.display='flex'">
         <div id="inv-logo-fb" class="inv-logo-fallback" style="display:none">${initial}</div>`
      : `<div class="inv-logo-fallback">${initial}</div>`;

    const rows = facture.lignes.map((line, i) => {
      const sous = line.sousTotal ?? (line.quantite * line.prixUnitaire);
      const remise = line.remisePourcentage ? `${line.remisePourcentage}%`
        : (line.remiseMontant ? this.formatPrice(line.remiseMontant) : '—');
      return `<tr class="${i % 2 === 0 ? 'even' : ''}">
        <td class="td-name">${line.designation || line.produitNom || 'Produit'}</td>
        <td class="td-center">${line.quantite}</td>
        <td class="td-right">${this.formatPrice(line.prixUnitaire)}</td>
        <td class="td-center td-remise">${remise}</td>
        <td class="td-right td-bold">${this.formatPrice(sous)}</td>
      </tr>`;
    }).join('');

    const hasRemise = facture.montantRemiseTotal > 0;
    const totauxRows = `
      <tr class="subtotal-row">
        <td colspan="4" class="td-right td-light">Sous-total</td>
        <td class="td-right">${this.formatPrice(facture.montantTotal)}</td>
      </tr>
      ${hasRemise ? `<tr class="subtotal-row"><td colspan="4" class="td-right td-light">Remise totale</td>
        <td class="td-right td-red">- ${this.formatPrice(facture.montantRemiseTotal)}</td></tr>` : ''}
      <tr class="total-row">
        <td colspan="4" class="td-right td-total-label">TOTAL À PAYER</td>
        <td class="td-right td-total-val">${this.formatPrice(facture.montantApresRemise || facture.montantTotal)}</td>
      </tr>`;

    const qrInfo = encodeURIComponent(
      `FACTURE ${facture.numeroFacture}\nDate: ${this.formatDate(facture.dateCreation)}\nClient: ${facture.clientNom || 'Client divers'}\nTotal: ${this.formatPrice(facture.montantApresRemise || facture.montantTotal)}`
    );
    const qrBlock = `<div style="margin-top:10px;text-align:center">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${qrInfo}"
           width="72" height="72" style="border-radius:6px;background:#fff;padding:3px" alt="QR" onerror="this.style.display='none'">
      <p style="font-size:9px;margin-top:2px;opacity:.65">Scanner pour vérifier</p>
    </div>`;

    // ── Couleurs selon design ──
    const p1 = design === 2 ? '#0f172a' : design === 3 ? '#18181b' : '#081648';
    const p2 = design === 2 ? '#1e293b' : design === 3 ? '#3f3f46' : '#1a56db';
    const acc = design === 2 ? '#f59e0b' : design === 3 ? '#18181b' : '#1a56db';
    const accLight = design === 2 ? '#fef3c7' : design === 3 ? '#f4f4f5' : '#eff6ff';
    const headerGrad = design === 2
      ? `background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);`
      : design === 3
        ? `background: #ffffff; border-bottom: 3px solid #18181b;`
        : `background: linear-gradient(135deg, #081648 0%, #0d2b85 50%, #1a56db 100%);`;
    const headerTextColor = design === 3 ? '#18181b' : '#ffffff';
    const headerSubColor  = design === 3 ? '#52525b' : design === 2 ? '#94a3b8' : 'rgba(255,255,255,0.60)';
    const logoFallbackBg  = design === 3 ? '#e4e4e7' : 'rgba(255,255,255,0.15)';
    const logoFallbackColor = design === 3 ? '#18181b' : '#ffffff';
    const numColor = design === 2 ? '#fbbf24' : design === 3 ? '#52525b' : '#93c5fd';
    const footerGrad = design === 2
      ? `background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);`
      : design === 3
        ? `background: #18181b;`
        : `background: linear-gradient(135deg, #081648 0%, #0d2b85 100%);`;
    const tblHead = design === 2
      ? `background: linear-gradient(135deg, #0f172a, #1e293b);`
      : design === 3
        ? `background: #18181b;`
        : `background: linear-gradient(135deg, #081648, #1a56db);`;
    const btnPrint = design === 2
      ? `background: linear-gradient(135deg, #0f172a, #f59e0b);`
      : design === 3
        ? `background: #18181b;`
        : `background: linear-gradient(135deg, #081648, #1a56db);`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Facture ${facture.numeroFacture} — ${nom}</title>
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
    .inv-statut{display:inline-block;margin-top:10px;padding:4px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;border:1.5px solid rgba(128,128,128,.3);color:${headerTextColor};background:rgba(128,128,128,.12)}
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
    tbody tr:hover{background:${accLight}}
    td{padding:10px 16px;font-size:13px;border-bottom:1px solid #f1f5f9}
    .td-name{font-weight:600;color:#0f172a}.td-center{text-align:center;color:#475569}
    .td-right{text-align:right;color:#475569}.td-bold{font-weight:700;color:#0f172a}
    .td-remise{color:#dc2626;font-weight:600}.td-light{color:#64748b;font-size:12px}.td-red{color:#dc2626;font-weight:700}
    .subtotal-row td{border-bottom:none;padding:6px 16px}
    .total-row{background:${accLight}}
    .total-row td{padding:14px 16px;border-top:2px solid ${acc}}
    .td-total-label{font-size:13px;font-weight:700;color:${acc};text-transform:uppercase;letter-spacing:.5px}
    .td-total-val{font-size:20px;font-weight:900;color:${acc}}
    .inv-notes{padding:16px 32px;border-top:1px solid #f1f5f9;font-size:12.5px;color:#64748b}
    .inv-notes strong{color:#334155}
    .inv-footer{${footerGrad}padding:16px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px}
    .inv-footer-brand{display:flex;align-items:center;gap:10px;color:rgba(255,255,255,.75);font-size:12px}
    .inv-footer-shop-name{font-weight:800;font-size:14px;color:#fff}
    .inv-footer-sep{color:rgba(255,255,255,.35);margin:0 6px}
    .inv-footer-thank{font-size:12px;color:rgba(255,255,255,.60);font-style:italic}
    .print-bar{text-align:center;padding:20px;background:#f8fafc}
    .btn-print{padding:12px 28px;${btnPrint}color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.3px}
    .btn-close-print{padding:12px 24px;background:#ef4444;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-left:10px}
    @media print{
      @page{size:A4;margin:10mm}
      body{background:white;padding:0;margin:0}
      .invoice-sheet{box-shadow:none;border-radius:0;max-width:100%;margin:0}
      .print-bar{display:none}
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
      <p class="inv-number">${facture.numeroFacture}</p>
      <p class="inv-date">Émise le ${this.formatDate(facture.dateCreation)}</p>
      <span class="inv-statut">${this.getStatutText(facture.statut)}</span>
      ${qrBlock}
    </div>
  </div>

  <div class="inv-info">
    <div class="inv-info-block">
      <p class="inv-info-label">Facturé à</p>
      <p class="inv-info-name">${facture.clientNom || 'Client divers'} ${facture.clientPrenom || ''}</p>
      <div class="inv-info-detail">
        ${facture.clientTelephone ? `📞 ${facture.clientTelephone}<br>` : ''}
        ${facture.clientAdresse   ? `📍 ${facture.clientAdresse}` : ''}
        ${!facture.clientTelephone && !facture.clientAdresse ? 'Aucune coordonnée' : ''}
      </div>
    </div>
    <div class="inv-info-block">
      <p class="inv-info-label">Détails facture</p>
      <div class="inv-info-detail">
        <strong>N° :</strong> ${facture.numeroFacture}<br>
        <strong>Date :</strong> ${this.formatDate(facture.dateCreation)}<br>
        <strong>Statut :</strong> <span style="color:${sc};font-weight:700">${this.getStatutText(facture.statut)}</span><br>
        ${facture.utilisateurNom ? `<strong>Vendeur :</strong> ${facture.utilisateurNom}<br>` : ''}
        ${facture.venteId ? `<strong>Vente liée :</strong> #${facture.venteId}` : ''}
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

  ${facture.notes ? `<div class="inv-notes"><strong>Notes :</strong> ${facture.notes}</div>` : ''}

  <div class="inv-footer">
    <div class="inv-footer-brand">
      <span class="inv-footer-shop-name">${nom}</span>
      ${adr || tel ? `<span class="inv-footer-sep">·</span><span>${adr}${ville ? ' ' + ville : ''}${tel ? ' — ' + tel : ''}</span>` : ''}
    </div>
    <p class="inv-footer-thank">Merci pour votre confiance !</p>
  </div>
</div>

<div class="print-bar">
  <button class="btn-print" onclick="window.print()">🖨 Imprimer / PDF</button>
  <button class="btn-close-print" onclick="window.close()">✕ Fermer</button>
</div>
<script>
(function(){
  var vw=window.innerWidth||document.documentElement.clientWidth;
  if(vw<820){var z=(vw/860);document.body.style.zoom=z;document.body.style.webkitTextSizeAdjust='none';}
})();
</script>
</body>
</html>`;
  }

  private handleError(error: any, context: string): Observable<never> {
    let message = `Impossible de ${context}`;
    if (error.status === 0) message = 'Impossible de se connecter au serveur';
    if (error.error?.message) message = error.error.message;
    else if (error.error?.error) message = error.error.error;
    else if (typeof error.error === 'string') message = error.error;
    return throwError(() => new Error(message));
  }
}
