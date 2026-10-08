import { Component, ElementRef, ViewChild } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Comptage, InventaireService, LigneComptage } from '../../services/inventaire.service';
import { Categorie, ProductService, Produit } from '../../services/product.service';
import { BarcodeService } from '../../services/barcode.service';
import { ConfirmSheetService } from '../../services/confirm-sheet.service';
import { RoleService } from '../../services/role.service';
import { AuthService } from '../../services/auth.service';
import { infoMesure, lireNombre, qteAffichee, qteStockee, texteQte } from '../../utils/mesure.util';

/**
 * Comptage d'inventaire : on compte les produits (douchette, caméra ou recherche), l'écran
 * montre les écarts avec le stock enregistré, puis la validation corrige le stock d'un coup.
 * Seul l'écart est appliqué (voir ComptageInventaireService) : on peut compter boutique ouverte.
 */
@Component({
  selector: 'app-comptage',
  templateUrl: './comptage.page.html',
  styleUrls: ['./comptage.page.scss'],
  standalone: false
})
export class ComptagePage {
  @ViewChild('champQuantite') champQuantite?: ElementRef<HTMLInputElement>;

  /** Écart jugé « gros » (à vérifier avant de valider) : au moins 5 unités et 20 % du stock. */
  private static readonly GROS_ECART_UNITES = 5;
  private static readonly GROS_ECART_PART = 0.2;

  chargement = true;
  envoi = false;
  comptage: Comptage | null = null;
  historique: Comptage[] = [];
  categories: Categorie[] = [];
  categorieChoisie: number | null = null;

  produits: Produit[] = [];
  recherche = '';
  resultats: Produit[] = [];
  produitChoisi: Produit | null = null;
  quantiteSaisie = '';
  filtreLignes: 'tous' | 'ecarts' = 'tous';

  constructor(
    private inventaire: InventaireService,
    private productService: ProductService,
    private barcode: BarcodeService,
    private confirmSheet: ConfirmSheetService,
    private toastCtrl: ToastController,
    private roleService: RoleService,
    private auth: AuthService
  ) {}

  /** Même règle que le serveur : gérant, ou rôle avec « Inventaire » sur Modifier/Tout. */
  get autorise(): boolean {
    const droit = this.roleService.peut('STOCK', 'GERER');
    return this.auth.isVendeur() ? (this.roleService.rolesActifs && droit) : droit;
  }

  ionViewWillEnter(): void {
    this.charger();
  }

  charger(ev?: any): void {
    this.chargement = true;
    this.inventaire.comptageEnCours().subscribe({
      next: c => {
        this.comptage = c;
        this.chargement = false;
        ev?.target?.complete();
        if (!c) this.chargerAccueil();
        else this.chargerProduits();
      },
      error: e => { this.chargement = false; ev?.target?.complete(); this.toast(this.erreur(e), 'danger'); }
    });
  }

  private chargerAccueil(): void {
    this.productService.getAllCategories().subscribe({ next: c => this.categories = c, error: () => {} });
    this.inventaire.historiqueComptages().subscribe({ next: h => this.historique = h, error: () => {} });
  }

  private chargerProduits(): void {
    this.productService.getProducts().subscribe({
      next: p => {
        const cat = this.comptage?.categorieId;
        this.produits = cat ? p.filter((x: any) => (x.categorie?.id ?? x.categorieId) === cat) : p;
      },
      error: () => {}
    });
  }

  // ---------------------------------------------------------------- démarrer / terminer

  demarrer(): void {
    this.envoi = true;
    this.inventaire.demarrerComptage(this.categorieChoisie).subscribe({
      next: c => { this.envoi = false; this.comptage = c; this.chargerProduits(); },
      error: e => { this.envoi = false; this.toast(this.erreur(e), 'danger'); }
    });
  }

  async valider(): Promise<void> {
    const c = this.comptage;
    if (!c) return;
    if (!c.nbComptes) { this.toast('Comptez au moins un produit avant de valider.', 'warning'); return; }
    const gros = (c.lignes || []).filter(l => this.grosEcart(l)).length;
    const ok = await this.confirmSheet.confirm({
      icon: 'checkmark-done-outline',
      title: 'Valider le comptage ?',
      message: `${c.nbEcarts} produit(s) avec un écart seront corrigés dans le stock. `
        + `Manquants : ${this.money(c.valeurManquants || 0)} · Surplus : ${this.money(c.valeurSurplus || 0)}.`
        + (gros ? ` Attention : ${gros} gros écart(s), vérifiez-les avant.` : '')
        + ' Les produits non comptés ne changent pas.',
      confirmLabel: 'Valider et corriger le stock'
    });
    if (!ok) return;
    this.envoi = true;
    this.inventaire.validerComptage(c.id).subscribe({
      next: () => { this.envoi = false; this.toast('Comptage validé : stock corrigé.', 'success'); this.raz(); this.charger(); },
      error: e => { this.envoi = false; this.toast(this.erreur(e), 'danger'); }
    });
  }

  async abandonner(): Promise<void> {
    const c = this.comptage;
    if (!c) return;
    const ok = await this.confirmSheet.confirm({
      icon: 'close-circle-outline',
      title: 'Abandonner le comptage ?',
      message: 'Rien ne sera modifié dans le stock. Les quantités comptées seront perdues.',
      confirmLabel: 'Abandonner',
      danger: true
    });
    if (!ok) return;
    this.inventaire.abandonnerComptage(c.id).subscribe({
      next: () => { this.toast('Comptage abandonné.', 'medium'); this.raz(); this.charger(); },
      error: e => this.toast(this.erreur(e), 'danger')
    });
  }

  private raz(): void {
    this.comptage = null;
    this.produitChoisi = null;
    this.recherche = '';
    this.resultats = [];
    this.quantiteSaisie = '';
  }

  // ---------------------------------------------------------------- compter un produit

  chercher(): void {
    const q = this.recherche.trim().toLowerCase();
    this.resultats = q
      ? this.produits.filter(p => p.nom.toLowerCase().includes(q) || (p as any).codeBarre?.toLowerCase().includes(q)).slice(0, 12)
      : [];
  }

  /** « Entrée » (douchette) : code-barres exact → produit choisi directement. */
  validerRecherche(): void {
    const code = this.recherche.trim();
    if (!code) return;
    const exact = this.produits.find(p => (p as any).codeBarre?.trim() === code);
    const p = exact ?? (this.resultats.length === 1 ? this.resultats[0] : undefined);
    if (p) this.choisir(p);
    else if (/^\d{6,}$/.test(code)) this.toast(`Produit introuvable pour le code : ${code}`, 'warning');
  }

  async scanner(): Promise<void> {
    const code = await this.barcode.scan();
    if (!code) return;
    this.recherche = code;
    this.chercher();
    this.validerRecherche();
  }

  choisir(p: Produit): void {
    this.produitChoisi = p;
    this.recherche = '';
    this.resultats = [];
    const deja = this.ligneDe(p.id);
    this.quantiteSaisie = deja ? String(qteAffichee(p, deja.quantiteComptee)) : '';
    setTimeout(() => this.champQuantite?.nativeElement.focus(), 80);
  }

  enregistrerQuantite(): void {
    const p = this.produitChoisi;
    const c = this.comptage;
    if (!p || !c) return;
    if (this.quantiteSaisie.trim() === '') { this.toast('Tapez la quantité comptée.', 'warning'); return; }
    const affichee = lireNombre(this.quantiteSaisie);
    if (!isFinite(affichee) || affichee < 0) { this.toast('Quantité invalide.', 'warning'); return; }
    this.envoi = true;
    this.inventaire.compterProduit(c.id, p.id, qteStockee(p, affichee)).subscribe({
      next: maj => { this.envoi = false; this.comptage = maj; this.produitChoisi = null; this.quantiteSaisie = ''; },
      error: e => { this.envoi = false; this.toast(this.erreur(e), 'danger'); }
    });
  }

  retirer(l: LigneComptage): void {
    const c = this.comptage;
    if (!c) return;
    this.inventaire.compterProduit(c.id, l.produitId, null).subscribe({
      next: maj => this.comptage = maj,
      error: e => this.toast(this.erreur(e), 'danger')
    });
  }

  modifier(l: LigneComptage): void {
    const p = this.produits.find(x => x.id === l.produitId);
    if (p) this.choisir(p);
  }

  // ---------------------------------------------------------------- affichage

  get lignesAffichees(): LigneComptage[] {
    const l = this.comptage?.lignes || [];
    return this.filtreLignes === 'ecarts' ? l.filter(x => x.ecart !== 0) : l;
  }

  ligneDe(produitId: number): LigneComptage | undefined {
    return this.comptage?.lignes?.find(l => l.produitId === produitId);
  }

  grosEcart(l: LigneComptage): boolean {
    const e = Math.abs(l.ecart);
    return e >= ComptagePage.GROS_ECART_UNITES && e >= Math.max(1, l.stockAuComptage) * ComptagePage.GROS_ECART_PART;
  }

  /** Quantité lisible (« 1,5 kg », ou « 12 » pour un produit à l'unité). */
  qte(produitId: number, stockee: number): string {
    return texteQte(this.produits.find(p => p.id === produitId) ?? null, stockee);
  }

  ecartTexte(l: LigneComptage): string {
    const t = this.qte(l.produitId, Math.abs(l.ecart));
    return l.ecart === 0 ? 'Juste' : (l.ecart > 0 ? `+${t}` : `−${t}`);
  }

  unite(p: Produit | null): string {
    return infoMesure(p)?.unite ?? 'unités';
  }

  stockTexte(p: Produit): string {
    return texteQte(p, (p as any).quantite);
  }

  money(v: number): string {
    return this.inventaire.formatPrice(v || 0);
  }

  private erreur(e: any): string {
    return e?.error?.message || e?.error?.error || 'Action impossible pour le moment.';
  }

  private async toast(message: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2600, color, position: 'bottom' });
    await t.present();
  }
}
