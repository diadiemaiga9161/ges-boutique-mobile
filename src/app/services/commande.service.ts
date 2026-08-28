import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export enum StatutCommande {
  BROUILLON = 'BROUILLON',
  VALIDEE = 'VALIDEE',
  ANNULEE = 'ANNULEE'
}

export interface LigneCommande {
  id?: number;
  produitId?: number;
  produitNom?: string;
  produit?: { id: number; nom: string; prixVente: number };
  quantite: number;
  prixUnitaire: number;
  sousTotal?: number;
}

export interface Commande {
  id: number;
  numeroCommande: string;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  client?: { id: number; nom: string; prenom: string; numeroTelephone: string };
  lignes: LigneCommande[];
  montantTotal: number;
  modePaiement: string;
  referencePaiement?: string;
  estCredit: boolean;
  montantVerse: number;
  montantRestant: number;
  dateEcheance?: string;
  statut: StatutCommande;
  dateCommande: string;
  dateValidation?: string;
  venteId?: number;
  notes?: string;
  vendeur?: { id: number; nomComplet: string };
  /** MAGASIN (par défaut) ou VITRINE (déposée par un client depuis le mini-site public). */
  origine?: 'MAGASIN' | 'VITRINE';
}

export interface CommandeRequest {
  vendeurId: number;
  clientId?: number;
  clientNom?: string;
  clientPrenom?: string;
  clientTelephone?: string;
  lignes: { produitId: number; quantite: number; prixUnitaire: number; remise?: number }[];
  modePaiement: string;
  referencePaiement?: string;
  estCredit?: boolean;
  montantVerse?: number;
  dateEcheance?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class CommandeService {
  private readonly apiUrl = `${environment.apiUrl}/commandes`;

  constructor(private http: HttpClient, private auth: AuthService) {}

  getAll(): Observable<Commande[]> {
    return this.http.get<Commande[]>(this.apiUrl);
  }

  /** Commandes vitrine (en ligne) pas encore traitées — pour le popup/badge "en attente". */
  getVitrineEnAttente(): Observable<Commande[]> {
    return this.http.get<Commande[]>(`${this.apiUrl}/vitrine-en-attente`);
  }

  getById(id: number): Observable<Commande> {
    return this.http.get<Commande>(`${this.apiUrl}/${id}`);
  }

  creer(request: CommandeRequest): Observable<any> {
    return this.http.post<any>(this.apiUrl, request);
  }

  modifier(id: number, request: CommandeRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request);
  }

  valider(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/valider`, {});
  }

  supprimer(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }

  annuler(id: number, utilisateurId?: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${id}/annuler`, { utilisateurId });
  }

  payerCredit(id: number, montant: number): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}/payer-credit`, { montant });
  }

  payerCreditsGroupes(ids: number[], montantTotal: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/payer-credits-groupes`, { ids, montantTotal });
  }

  formatMontant(v: number): string {
    const n = Math.round(v || 0);
    return `${n < 0 ? '-' : ''}${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getClientNom(c: Commande): string {
    return [c.clientNom, c.clientPrenom].filter(Boolean).join(' ') || c.client?.nom || 'N/A';
  }

  async partagerCommande(commande: Commande): Promise<void> {
    const html = this.buildHtmlCommande(commande);
    const nom = `Commande_${commande.numeroCommande.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    try {
      const b64 = btoa(unescape(encodeURIComponent(html)));
      const result = await Filesystem.writeFile({ path: nom, data: b64, directory: Directory.Cache });
      await Share.share({
        title: `Commande ${commande.numeroCommande}`,
        text: `Bon de commande ${commande.numeroCommande} — ${this.getClientNom(commande)} — ${this.formatMontant(commande.montantTotal)}`,
        url: result.uri,
        dialogTitle: 'Partager la commande',
      });
    } catch {
      const text = `📦 *Commande ${commande.numeroCommande}*\n👤 ${this.getClientNom(commande)}\n💰 ${this.formatMontant(commande.montantTotal)}\n📅 ${this.formatDate(commande.dateCommande)}`;
      await Share.share({ title: `Commande ${commande.numeroCommande}`, text, dialogTitle: 'Partager' }).catch(() => {});
    }
  }

  private buildHtmlCommande(commande: Commande): string {
    const clientNom = this.getClientNom(commande);
    const date = this.formatDate(commande.dateCommande);
    const lignesHtml = commande.lignes.map((l, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${l.produit?.nom || l.produitNom || ''}</td>
        <td style="text-align:center">${l.quantite}</td>
        <td style="text-align:right">${this.formatMontant(l.prixUnitaire)}</td>
        <td style="text-align:right">${this.formatMontant(l.sousTotal || l.prixUnitaire * l.quantite)}</td>
      </tr>`).join('');
    const creditHtml = commande.estCredit ? `
      <tr><td colspan="4" style="text-align:right;color:#16a34a">Versé</td><td style="text-align:right;color:#16a34a">${this.formatMontant(commande.montantVerse)}</td></tr>
      <tr><td colspan="4" style="text-align:right;color:#dc2626"><strong>Reste dû</strong></td><td style="text-align:right;color:#dc2626"><strong>${this.formatMontant(commande.montantRestant)}</strong></td></tr>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Bon de Commande ${commande.numeroCommande}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;background:#f0f4f8;min-height:100vh}
        .toolbar{display:flex;align-items:center;justify-content:space-between;background:#1e40af;color:#fff;padding:12px 20px;position:sticky;top:0;z-index:10}
        .toolbar-title{font-size:15px;font-weight:700}
        .toolbar-actions{display:flex;gap:8px}
        .btn-close{background:rgba(255,255,255,0.2);border:1.5px solid rgba(255,255,255,0.4);color:#fff;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:600;cursor:pointer}
        .btn-print{background:#fff;border:none;color:#1e40af;border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700;cursor:pointer}
        .page{max-width:700px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)}
        .doc-header{background:linear-gradient(135deg,#1e3a8a,#1a56db);color:#fff;padding:24px;text-align:center}
        .doc-header h1{font-size:22px;font-weight:800;margin-bottom:4px}
        .doc-header p{font-size:13px;opacity:.8}
        .doc-body{padding:20px}
        .doc-info{display:flex;justify-content:space-between;gap:16px;margin-bottom:20px;padding:14px;background:#f8fafc;border-radius:10px;font-size:13px}
        .doc-info-col{display:flex;flex-direction:column;gap:4px}
        .doc-info-col span{color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
        .doc-info-col strong{color:#0f172a;font-size:14px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        thead th{background:#1e40af;color:#fff;padding:10px 8px;text-align:left;font-weight:600}
        tbody td{padding:9px 8px;border-bottom:1px solid #f1f5f9;color:#1e293b}
        tbody tr:nth-child(even) td{background:#f8fafc}
        .row-total td{background:#eff6ff!important;font-weight:700;color:#1e40af}
        .credit-section{margin-top:12px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px}
        .credit-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
        .credit-reste{color:#dc2626;font-weight:700;font-size:15px}
        .doc-footer{margin-top:20px;text-align:center;font-size:11px;color:#94a3b8;padding-bottom:8px}
        @media print{@page{size:A4;margin:8mm}.toolbar{display:none!important}.page{margin:0;box-shadow:none;border-radius:0;max-width:100%}}
      </style></head><body>
      <div class="toolbar">
        <span class="toolbar-title">Bon de Commande — ${commande.numeroCommande}</span>
        <div class="toolbar-actions">
          <button class="btn-print" onclick="window.print()">Imprimer</button>
          <button class="btn-close" onclick="window.close()">✕ Fermer</button>
        </div>
      </div>
      <div class="page">
        <div class="doc-header">
          <h1>BON DE COMMANDE</h1>
          <p>${commande.numeroCommande} · ${date}</p>
        </div>
        <div class="doc-body">
          <div class="doc-info">
            <div class="doc-info-col">
              <span>Client</span><strong>${clientNom}</strong>
              ${commande.clientTelephone ? '<span>Téléphone</span><strong>' + commande.clientTelephone + '</strong>' : ''}
            </div>
            <div class="doc-info-col" style="text-align:right">
              <span>Statut</span><strong>${commande.statut}</strong>
              <span>Mode paiement</span><strong>${commande.modePaiement}</strong>
            </div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Produit</th><th style="text-align:center">Qté</th><th style="text-align:right">Prix unit.</th><th style="text-align:right">Sous-total</th></tr></thead>
            <tbody>${lignesHtml}
              <tr class="row-total"><td colspan="4" style="text-align:right">TOTAL</td><td style="text-align:right">${this.formatMontant(commande.montantTotal)}</td></tr>
            </tbody>
          </table>
          ${commande.estCredit ? `<div class="credit-section">
            <div class="credit-row"><span>Versé</span><span style="color:#16a34a;font-weight:700">${this.formatMontant(commande.montantVerse)}</span></div>
            <div class="credit-row"><span>Reste dû</span><span class="credit-reste">${this.formatMontant(commande.montantRestant)}</span></div>
            ${commande.dateEcheance ? '<div class="credit-row"><span>Échéance</span><span>' + commande.dateEcheance + '</span></div>' : ''}
          </div>` : ''}
          ${commande.notes ? '<p style="margin-top:14px;font-size:13px;color:#64748b"><strong>Notes :</strong> ' + commande.notes + '</p>' : ''}
          <div class="doc-footer">Document généré par Ges-Boutique</div>
        </div>
      </div>
    </body></html>`;
    return html;
  }

  imprimerBonCommande(commande: Commande): void {
    this.openOverlay(this.buildHtmlCommande(commande), commande);
  }

  private openOverlay(html: string, commande: Commande): void {
    document.getElementById('inv-overlay-root')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'inv-overlay-root';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:rgba(0,0,0,.65)';

    const htmlWithZoom = html.replace('</body>', `<script>(function(){var vw=window.innerWidth||document.documentElement.clientWidth;if(vw<700){document.body.style.zoom=(vw/740);}})();</script></body>`);
    const frame = document.createElement('iframe');
    frame.id = 'inv-frame-root';
    frame.style.cssText = 'flex:1;width:100%;border:none;background:#f8fafc';
    frame.setAttribute('srcdoc', htmlWithZoom);

    const bar = document.createElement('div');
    bar.style.cssText = 'background:#1e40af;padding:10px 16px;display:flex;gap:8px;align-items:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.3);flex-wrap:wrap';

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fermer';
    btnClose.style.cssText = 'background:#ef4444;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer';
    btnClose.addEventListener('click', () => overlay.remove());

    const btnPrint = document.createElement('button');
    btnPrint.textContent = '🖨 Imprimer';
    btnPrint.style.cssText = 'background:#fff;color:#1e40af;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer';
    btnPrint.addEventListener('click', () => frame.contentWindow?.print());

    const btnShare = document.createElement('button');
    btnShare.textContent = '📤 Partager';
    btnShare.style.cssText = 'background:#25D366;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer';
    btnShare.addEventListener('click', () => this.partagerCommande(commande));

    bar.appendChild(btnClose);
    bar.appendChild(btnPrint);
    bar.appendChild(btnShare);
    overlay.appendChild(bar);
    overlay.appendChild(frame);
    document.body.appendChild(overlay);
  }
}
