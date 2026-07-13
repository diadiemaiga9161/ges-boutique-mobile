import { Component } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { Depense, DepenseRequest, DepenseService, TypeDepense } from '../../services/depense.service';
import { PaiementEmploye, PaiementEmployeService } from '../../services/paiement-employe.service';
import { BoutiqueService } from '../../services/boutique.service';

@Component({
  selector: 'app-depenses',
  templateUrl: './depenses.page.html',
  styleUrls: ['./depenses.page.scss'],
  standalone: false
})
export class DepensesPage {

  depenses: Depense[] = [];
  paiementsEmploye: PaiementEmploye[] = [];
  totalDepenses = 0;
  loading = false;
  showForm = false;
  editing: Depense | null = null;

  typesDepense: TypeDepense[] = [];
  showTypesModal = false;
  newTypeName = '';
  editingTypeId: number | null = null;
  editingTypeName = '';
  typesError = '';

  totauxParType: { type: string; total: number }[] = [];

  // Filtres
  typeDepenseFiltreSelectionne: string = '';
  moisFiltre: string = '';
  dateDebut = '';
  dateFin = '';

  // Pagination
  pageActuelle = 1;
  itemsParPage = 10;

  form: DepenseRequest = this.emptyForm();

  trackById = (_: number, item: any) => item.id;

  constructor(
    private depenseService: DepenseService,
    private paiementEmployeService: PaiementEmployeService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private boutiqueService: BoutiqueService
  ) {}

  ionViewWillEnter(): void {
    this.load();
    this.loadTypes();
  }

  load(event?: any): void {
    this.loading = true;
    this.pageActuelle = 1;
    forkJoin({
      dep: this.depenseService.getAll(),
      sal: this.paiementEmployeService.getTous()
    }).subscribe({
      next: ({ dep, sal }) => {
        // Normalisation robuste de la réponse
        const depenses = (dep as any)?.data?.depenses || (dep as any)?.depenses || (Array.isArray(dep) ? dep : []);
        const total = (dep as any)?.data?.total || (dep as any)?.total || depenses.reduce((s: number, d: any) => s + (d.montant || 0), 0);
        this.depenses = depenses;
        this.paiementsEmploye = (Array.isArray(sal) ? sal : []).filter((p: PaiementEmploye) => p.statut === 'PAYE');
        this.totalDepenses = total + this.paiementsEmploye.reduce((s, p) => s + p.montant, 0);
        this.loading = false;
        this.calculerTotauxParType();
        event?.target?.complete();
      },
      error: e => {
        this.loading = false;
        event?.target?.complete();
        this.toast(e.message, 'danger');
      }
    });
  }

  filtrerPeriode(): void {
    if (!this.dateDebut || !this.dateFin) {
      this.toast('Veuillez saisir les deux dates', 'warning');
      return;
    }
    this.loading = true;
    this.pageActuelle = 1;
    this.depenseService.getParPeriode(this.dateDebut, this.dateFin).subscribe({
      next: (response: any) => {
        // Normalisation robuste de la réponse période
        const depenses = response?.data?.depenses || response?.depenses || (Array.isArray(response) ? response : []);
        const total = response?.data?.total || response?.total || depenses.reduce((s: number, d: any) => s + (d.montant || 0), 0);
        this.depenses = depenses;
        this.totalDepenses = total + this.paiementsEmploye.reduce((s, p) => s + p.montant, 0);
        this.loading = false;
        this.calculerTotauxParType();
      },
      error: e => { this.loading = false; this.toast(e.message, 'danger'); }
    });
  }

  reinitialiser(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.typeDepenseFiltreSelectionne = '';
    this.moisFiltre = '';
    this.pageActuelle = 1;
    this.load();
  }

  get paiementsCommeDep(): any[] {
    return this.paiementsEmploye.map(p => ({
      id: 'emp_' + p.id,
      nom: p.employeNomComplet,
      motif: p.employePoste || 'Salaire',
      date: (p.datePaiement || '').split('T')[0],
      montant: p.montant,
      typeDepense: 'Salaire',
      periodeDebut: p.periodeDebut,
      periodeFin: p.periodeFin,
      salaireMensuel: p.salaireMensuel,
      nombreMois: p.nombreMois,
      employePoste: p.employePoste,
      sourceExterne: true
    }));
  }

  get toutesDepenses(): any[] {
    return [...this.depenses, ...this.paiementsCommeDep];
  }

  get depensesFiltrees(): any[] {
    let liste = this.toutesDepenses;
    if (this.typeDepenseFiltreSelectionne) {
      liste = liste.filter(d => (d.typeDepense || '') === this.typeDepenseFiltreSelectionne);
    }
    if (this.moisFiltre) {
      liste = liste.filter(d => d.date && d.date.startsWith(this.moisFiltre));
    }
    return liste;
  }

  // Pagination
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.depensesFiltrees.length / this.itemsParPage));
  }

  get depensesPaginees(): any[] {
    const debut = (this.pageActuelle - 1) * this.itemsParPage;
    return this.depensesFiltrees.slice(debut, debut + this.itemsParPage);
  }

  pagePrecedente(): void {
    if (this.pageActuelle > 1) this.pageActuelle--;
  }

  pageSuivante(): void {
    if (this.pageActuelle < this.totalPages) this.pageActuelle++;
  }

  get totalFiltre(): number {
    return this.depensesFiltrees.reduce((s, d) => s + (d.montant || 0), 0);
  }

  calculerTotauxParType(): void {
    const map = new Map<string, number>();
    for (const d of this.toutesDepenses) {
      const type = d.typeDepense || 'Autre';
      map.set(type, (map.get(type) || 0) + d.montant);
    }
    this.totauxParType = Array.from(map.entries())
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);
  }

  loadTypes(): void {
    this.depenseService.getTypes().subscribe({
      next: types => this.typesDepense = types,
      error: () => {}
    });
  }

  async ouvrirGestionTypes() {
    this.showTypesModal = true;
    this.typesError = '';
  }

  fermerGestionTypes() {
    this.showTypesModal = false;
    this.newTypeName = '';
    this.editingTypeId = null;
    this.editingTypeName = '';
    this.typesError = '';
  }

  ajouterType() {
    const nom = this.newTypeName.trim();
    if (!nom) return;
    this.depenseService.creerType(nom).subscribe({
      next: t => {
        this.typesDepense = [...this.typesDepense, t].sort((a, b) => a.nom.localeCompare(b.nom));
        this.newTypeName = '';
        this.typesError = '';
      },
      error: e => { this.typesError = e.message; }
    });
  }

  startEditType(type: TypeDepense) {
    this.editingTypeId = type.id;
    this.editingTypeName = type.nom;
  }

  cancelEditType() {
    this.editingTypeId = null;
    this.editingTypeName = '';
  }

  saveEditType() {
    if (!this.editingTypeId || !this.editingTypeName.trim()) return;
    this.depenseService.modifierType(this.editingTypeId, this.editingTypeName.trim()).subscribe({
      next: t => {
        const idx = this.typesDepense.findIndex(x => x.id === t.id);
        if (idx >= 0) this.typesDepense[idx] = t;
        this.typesDepense = [...this.typesDepense].sort((a, b) => a.nom.localeCompare(b.nom));
        this.editingTypeId = null;
        this.editingTypeName = '';
        this.typesError = '';
      },
      error: e => { this.typesError = e.message; }
    });
  }

  async supprimerType(type: TypeDepense) {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ce type ?',
      message: `Supprimer "${type.nom}" ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', role: 'destructive',
          handler: () => {
            this.depenseService.supprimerType(type.id).subscribe({
              next: () => {
                this.typesDepense = this.typesDepense.filter(t => t.id !== type.id);
                this.typesError = '';
              },
              error: e => { this.typesError = e.message || 'Ce type est utilisé par des dépenses'; }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  startCreate(): void {
    this.editing = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  startEdit(d: Depense): void {
    this.editing = d;
    this.form = { nom: d.nom, motif: d.motif || '', date: d.date, montant: d.montant, typeDepense: d.typeDepense || '' };
    this.showForm = true;
  }

  save(): void {
    if (!this.form.nom?.trim()) { this.toast('Le nom est obligatoire', 'danger'); return; }
    if (!this.form.montant || this.form.montant <= 0) { this.toast('Le montant doit être supérieur à 0', 'danger'); return; }
    if (!this.form.date) { this.toast('La date est obligatoire', 'danger'); return; }

    const action = this.editing
      ? this.depenseService.modifier(this.editing.id!, this.form)
      : this.depenseService.creer(this.form);

    action.subscribe({
      next: () => {
        this.showForm = false;
        this.load();
        this.toast(this.editing ? 'Dépense modifiée' : 'Dépense créée');
      },
      error: e => this.toast(e.message, 'danger')
    });
  }

  async supprimer(d: Depense): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer cette dépense ?',
      message: `${d.nom} — ${this.money(d.montant)}`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', role: 'destructive',
          handler: () => {
            this.depenseService.supprimer(d.id!).subscribe({
              next: () => { this.load(); this.toast('Dépense supprimée'); },
              error: e => this.toast(e.message, 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  // ======= PDF Dépenses =======

  telechargerRecuSalaire(dep: any): void {
    const boutique = this.boutiqueService.getInfo();
    const boutiqueName = boutique?.nom || 'Ges Boutique';
    const qrData = encodeURIComponent(`SALAIRE\nEmployé: ${dep.nom}\nPoste: ${dep.employePoste || ''}\nMontant: ${dep.montant} FCFA\nDate: ${dep.date || ''}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;
    const montantFmt = (dep.montant || 0).toLocaleString('fr-FR');
    const salaireFmt = (dep.salaireMensuel || 0).toLocaleString('fr-FR');

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Reçu paiement — ${dep.nom}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f4f8;padding:20px;font-size:13px;color:#1e293b}
.sheet{background:#fff;max-width:540px;margin:0 auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(5,80,40,.12)}
.hdr{background:linear-gradient(135deg,#064e3b,#10b981);color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:center}
.hdr-title{font-size:18px;font-weight:900}.hdr-sub{font-size:11px;opacity:.7;margin-top:3px}
.recu-label{text-align:center;padding:14px;font-size:12px;font-weight:700;letter-spacing:2px;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0}
.body{padding:18px 24px}
.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f1f5f9}
.row:last-child{border-bottom:none}
.lbl{color:#64748b;font-size:12px}.val{font-weight:700;color:#1e293b;font-size:12px;text-align:right}
.montant-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #86efac;border-radius:12px;padding:18px;text-align:center;margin:16px 0}
.montant-val{font-size:1.8rem;font-weight:900;color:#166534}
.montant-lbl{font-size:11px;color:#16a34a;text-transform:uppercase;letter-spacing:1px;margin-top:3px}
.btn-bar{display:flex;gap:8px;justify-content:center;padding:10px;background:#f8fafc;border-bottom:1px solid #e5e7eb}
.btn{border:none;border-radius:8px;padding:8px 18px;font-size:13px;font-weight:700;cursor:pointer}
.btn-p{background:#10b981;color:#fff}.btn-c{background:#ef4444;color:#fff}
.stamp{display:inline-block;border:3px solid #10b981;border-radius:8px;padding:5px 14px;color:#064e3b;font-weight:900;font-size:13px;letter-spacing:2px;transform:rotate(-3deg);margin:8px auto}
.ftr{background:linear-gradient(135deg,#064e3b,#10b981);color:rgba(255,255,255,.6);text-align:center;padding:10px;font-size:10px}
@media print{.btn-bar{display:none}body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}
</style></head><body>
<div class="sheet">
  <div class="hdr">
    <div><div class="hdr-title">REÇU DE PAIEMENT</div><div class="hdr-sub">${boutiqueName} &mdash; Paiement Employé</div></div>
    <img src="${qrUrl}" width="68" height="68" style="border-radius:8px;background:#fff;padding:3px" alt="QR" onerror="this.style.display='none'">
  </div>
  <div class="btn-bar">
    <button class="btn btn-p" onclick="window.print()">Imprimer / PDF</button>
    <button class="btn btn-c" onclick="document.getElementById('dep-overlay-root').remove()">Fermer</button>
  </div>
  <div class="recu-label">Reçu de salaire</div>
  <div class="body">
    <div class="row"><span class="lbl">Employé</span><span class="val">${dep.nom}</span></div>
    <div class="row"><span class="lbl">Poste</span><span class="val">${dep.employePoste || '—'}</span></div>
    ${dep.salaireMensuel ? `<div class="row"><span class="lbl">Salaire mensuel</span><span class="val">${salaireFmt} FCFA</span></div>` : ''}
    <div class="row"><span class="lbl">Nombre de mois</span><span class="val">${dep.nombreMois || 1} mois</span></div>
    <div class="row"><span class="lbl">Période</span><span class="val">${dep.periodeDebut || '—'}${dep.periodeFin && dep.periodeFin !== dep.periodeDebut ? ' → ' + dep.periodeFin : ''}</span></div>
    <div class="row"><span class="lbl">Date de paiement</span><span class="val">${dep.date || '—'}</span></div>
    <div class="montant-box">
      <div class="montant-lbl">Montant payé</div>
      <div class="montant-val">${montantFmt} FCFA</div>
    </div>
    <div style="text-align:center"><div class="stamp">✓ PAYÉ</div></div>
  </div>
  <div class="ftr">${boutiqueName} &middot; Reçu généré le ${new Date().toLocaleDateString('fr-FR')}</div>
</div></body></html>`;

    this.openLocalOverlay(html);
  }

  ouvrirPdfDepenses(): void {
    const shop = this.boutiqueService.getInfo();
    const date = new Date().toLocaleDateString('fr-FR');
    const liste = this.depensesFiltrees;
    const total = this.totalFiltre;

    const qrData = encodeURIComponent('Depenses ' + (shop.nom || 'Boutique') + ' ' + date + ' Total: ' + this.money(total));
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=' + qrData;

    const filtreTitre = this.typeDepenseFiltreSelectionne || this.moisFiltre
      ? ' (filtre: ' + [this.typeDepenseFiltreSelectionne, this.moisFiltre].filter(Boolean).join(', ') + ')'
      : '';

    const lignesResume = this.totauxParType.map((t, i) =>
      '<tr style="background:' + (i % 2 === 0 ? '#fff' : '#f8fafc') + '">' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px">' + t.type + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700;color:#dc2626">' + this.money(t.total) + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;color:#64748b">' + Math.round((t.total / (this.totalDepenses || 1)) * 100) + '%</td>' +
      '</tr>'
    ).join('');

    const lignesDepenses = liste.map((d, i) =>
      '<tr style="background:' + (d.sourceExterne ? '#fffbeb' : (i % 2 === 0 ? '#fff' : '#f8fafc')) + '">' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px">' + (d.date || '') + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;font-weight:600">' + d.nom + (d.sourceExterne ? ' <span style="font-size:10px;background:#f59e0b;color:#fff;padding:1px 5px;border-radius:3px">Salaire</span>' : '') + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">' + (d.typeDepense || 'Non défini') + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;color:#64748b">' + (d.motif || '') + (d.periodeDebut ? ' (' + d.periodeDebut + (d.periodeFin ? '→' + d.periodeFin : '') + ')' : '') + '</td>' +
      '<td style="padding:7px 8px;border:1px solid #eee;font-size:12px;text-align:right;font-weight:700;color:#dc2626">' + this.money(d.montant) + '</td>' +
      '</tr>'
    ).join('');

    const html = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Rapport Depenses</title>' +
      '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;background:#f0f4f8;padding:24px;font-size:13px;color:#1e293b}' +
      '.sheet{background:#fff;max-width:900px;margin:0 auto;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);overflow:hidden}' +
      '.hdr{background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;padding:24px 32px;display:flex;justify-content:space-between;align-items:flex-start}' +
      '.hdr-left h1{font-size:22px;font-weight:900;margin-bottom:4px}.hdr-left p{font-size:12px;opacity:.75;margin-top:3px}' +
      '.body{padding:24px 32px}' +
      '.section-title{font-size:11px;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:1px;margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid #fee2e2}' +
      '.total-box{background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}' +
      '.total-lbl{font-size:11px;letter-spacing:2px;opacity:.8;text-transform:uppercase}.total-val{font-size:24px;font-weight:900}' +
      'table{width:100%;border-collapse:collapse;margin-top:8px}' +
      'thead tr{background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff}' +
      'thead th{padding:9px 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left;border:1px solid rgba(255,255,255,.1)}' +
      '.ftr{background:#f1f5f9;padding:14px 32px;font-size:11px;color:#64748b;text-align:center}' +
      '.btn-bar{display:flex;gap:8px;margin-bottom:16px}' +
      '.btn-print{background:#dc2626;color:#fff;border:none;padding:8px 20px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}' +
      '.btn-close{background:#64748b;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer}' +
      '@media print{.btn-bar{display:none}body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;max-width:100%}}' +
      '</style></head><body>' +
      '<div class="sheet">' +
      '<div class="hdr"><div class="hdr-left"><h1>Rapport Depenses' + filtreTitre + '</h1>' +
      '<p>' + (shop.nom || 'Ges Boutique') + '</p><p>Genere le ' + date + '</p>' +
      (this.dateDebut && this.dateFin ? '<p>Periode : ' + this.dateDebut + ' au ' + this.dateFin + '</p>' : '') +
      '</div><div style="text-align:right"><img src="' + qrUrl + '" width="80" height="80" style="border-radius:6px;background:#fff;padding:3px" alt="QR"></div></div>' +
      '<div class="body">' +
      '<div class="btn-bar"><button class="btn-print" onclick="window.print()">Imprimer / PDF</button><button class="btn-close" onclick="window.close()">Fermer</button></div>' +
      '<div class="total-box"><div><div class="total-lbl">Total depenses</div><div class="total-val">' + this.money(total) + '</div></div>' +
      '<div style="text-align:right;font-size:12px;opacity:.8"><div>' + liste.length + ' depense(s)</div></div></div>' +
      (this.totauxParType.length ? '<div class="section-title">Repartition par type</div>' +
        '<table><thead><tr><th>Type</th><th style="text-align:right">Montant</th><th style="text-align:right">%</th></tr></thead><tbody>' + lignesResume + '</tbody></table>' : '') +
      '<div class="section-title">Liste des depenses (' + liste.length + ')</div>' +
      '<table><thead><tr><th>Date</th><th>Nom</th><th>Type</th><th>Motif</th><th style="text-align:right">Montant</th></tr></thead><tbody>' + lignesDepenses + '</tbody></table>' +
      '<div style="text-align:right;padding-top:12px;font-weight:700;font-size:14px;color:#dc2626">TOTAL : ' + this.money(total) + '</div>' +
      '</div><div class="ftr">' + (shop.nom || 'Ges Boutique') + ' · Rapport Depenses · ' + date + '</div></div>' +
      '</body></html>';

    this.openLocalOverlay(html);
  }

  private openLocalOverlay(html: string): void {
    document.getElementById('dep-overlay-root')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'dep-overlay-root';
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
    bar.style.cssText = 'background:#dc2626;padding:10px 16px;padding-bottom:max(10px,env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap';

    const btnClose = document.createElement('button');
    btnClose.textContent = '✕ Fermer';
    btnClose.style.cssText = 'background:#fff;color:#dc2626;border:none;border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
    btnClose.addEventListener('click', () => overlay.remove());

    const btnPrint = document.createElement('button');
    btnPrint.textContent = 'Imprimer';
    btnPrint.style.cssText = 'background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:8px;padding:10px 20px;font-size:14px;font-weight:700;cursor:pointer;min-height:44px';
    btnPrint.addEventListener('click', () => frame.contentWindow?.print());

    bar.appendChild(btnClose);
    bar.appendChild(btnPrint);
    overlay.appendChild(frame);
    overlay.appendChild(bar);
    document.body.appendChild(overlay);
  }

  getIconeType(nom: string): string {
    const n = (nom || '').toLowerCase();
    if (/loyer|maison|location|logement|appartement|bail/.test(n)) return 'home-outline';
    if (/transport|carburant|essence|voiture|taxi|moto|bus|véhicule|vehicle|carburan/.test(n)) return 'car-outline';
    if (/électricité|electricite|courant|énergie|energie|lumière|lumiere|kwh/.test(n)) return 'flash-outline';
    if (/eau|eau courante|facture eau|robinet/.test(n)) return 'water-outline';
    if (/nourriture|alimentation|repas|restaurant|manger|vivres|provisions|courses/.test(n)) return 'restaurant-outline';
    if (/téléphone|telephone|mobile|forfait|appel|communication|teleph/.test(n)) return 'call-outline';
    if (/internet|wifi|connexion|web|fibre|adsl/.test(n)) return 'wifi-outline';
    if (/salaire|employé|employe|paie|paye|personnel|staff/.test(n)) return 'people-outline';
    if (/fourniture|matériel|materiel|bureau|papeterie|consommable/.test(n)) return 'construct-outline';
    if (/santé|sante|médecin|medecin|pharmacie|médicament|medicament|hôpital|hopital|clinique/.test(n)) return 'medkit-outline';
    if (/publicité|publicite|marketing|pub|annonce|communication/.test(n)) return 'megaphone-outline';
    if (/entretien|nettoyage|maintenance|réparation|reparation|ménage|menage/.test(n)) return 'build-outline';
    if (/impôt|impot|taxe|fiscalité|fiscalite|douane|droit/.test(n)) return 'receipt-outline';
    if (/assurance/.test(n)) return 'shield-checkmark-outline';
    if (/formation|école|ecole|éducation|education|cours|stage/.test(n)) return 'school-outline';
    if (/carburan|pétrole|petrole|fuel/.test(n)) return 'flame-outline';
    if (/locat|rent/.test(n)) return 'business-outline';
    return 'pricetag-outline';
  }

  money(v: number): string {
    return this.depenseService.formatPrice(v);
  }

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private emptyForm(): DepenseRequest {
    return { nom: '', motif: '', date: this.today, montant: 0, typeDepense: '' };
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2500, position: 'top' });
    await t.present();
  }
}
