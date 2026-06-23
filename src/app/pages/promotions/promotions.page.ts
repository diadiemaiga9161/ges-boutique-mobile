import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Promotion, PromotionService, WhatsAppLien, WhatsAppResult } from '../../services/promotion.service';
import { BoutiqueService } from '../../services/boutique.service';
import { ProductService, Produit } from '../../services/product.service';

@Component({
  selector: 'app-promotions',
  templateUrl: './promotions.page.html',
  styleUrls: ['./promotions.page.scss'],
  standalone: false
})
export class PromotionsPage implements OnInit {

  promotions: Promotion[] = [];
  loading = false;
  showForm = false;
  editing: Promotion | null = null;

  // WhatsApp
  showWAModal = false;
  whatsAppResult: WhatsAppResult | null = null;
  loadingWA = false;
  searchWA = '';
  autoEnvoi = false;
  envoiEnCours = false;
  envoiIndex = 0;

  today = new Date().toISOString().split('T')[0];

  form: Partial<Promotion> = this.emptyForm();

  // Sélection produits pour promo par produits
  allProduits: Produit[] = [];
  produitSearch = '';
  showProduitDropdown = false;

  constructor(
    private promotionService: PromotionService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private boutiqueService: BoutiqueService,
    private productService: ProductService
  ) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.load();
    this.loadProduits();
  }

  loadProduits(): void {
    this.productService.getProducts().subscribe({
      next: p => this.allProduits = p,
      error: () => {}
    });
  }

  get produitsFiltres(): Produit[] {
    const q = this.produitSearch.toLowerCase().trim();
    if (!q) return this.allProduits.slice(0, 30);
    return this.allProduits.filter(p => p.nom.toLowerCase().includes(q)).slice(0, 20);
  }

  isProduitSelectionne(p: Produit): boolean {
    return (this.form.produitIds || []).includes(p.id!);
  }

  toggleProduit(p: Produit): void {
    const ids = [...(this.form.produitIds || [])];
    const idx = ids.indexOf(p.id!);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(p.id!);
    this.form.produitIds = ids;
  }

  getProduitNom(id: number): string {
    return this.allProduits.find(p => p.id === id)?.nom || `#${id}`;
  }

  retirerProduit(id: number): void {
    this.form.produitIds = (this.form.produitIds || []).filter(i => i !== id);
  }

  load(event?: any): void {
    this.loading = true;
    this.promotionService.getAll().subscribe({
      next: (promos) => {
        this.promotions = promos;
        this.loading = false;
        if (event) event.target.complete();
      },
      error: e => {
        this.loading = false;
        if (event) event.target.complete();
        this.showToast(e.message, 'danger');
      }
    });
  }

  startCreate(): void {
    this.editing = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  startEdit(promo: Promotion): void {
    this.editing = promo;
    this.form = { ...promo, produitIds: [...(promo.produitIds || [])] };
    this.showForm = true;
  }

  cancel(): void {
    this.showForm = false;
    this.editing = null;
    this.form = this.emptyForm();
  }

  async save(): Promise<void> {
    if (!this.form.titre?.trim()) { this.showToast('Le titre est obligatoire', 'danger'); return; }
    if (!this.form.dateDebut || !this.form.dateFin) { this.showToast('Les dates sont obligatoires', 'danger'); return; }
    if (this.form.dateFin! < this.form.dateDebut!) { this.showToast('La date de fin doit être après la date de début', 'danger'); return; }
    if (!this.form.valeurReduction || this.form.valeurReduction <= 0) { this.showToast('La valeur doit être supérieure à 0', 'danger'); return; }
    if (this.form.typeReduction === 'POURCENTAGE' && this.form.valeurReduction > 100) { this.showToast('Le pourcentage ne peut pas dépasser 100', 'danger'); return; }

    this.loading = true;
    const obs = this.editing
      ? this.promotionService.modifier(this.editing.id!, this.form)
      : this.promotionService.creer(this.form);

    obs.subscribe({
      next: () => {
        this.loading = false;
        this.cancel();
        this.load();
        this.showToast(this.editing ? 'Promotion modifiée' : 'Promotion créée', 'success');
      },
      error: e => { this.loading = false; this.showToast(e.message, 'danger'); }
    });
  }

  async supprimer(promo: Promotion): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ?',
      message: `Supprimer "${promo.titre}" ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', role: 'destructive',
          handler: () => {
            this.promotionService.supprimer(promo.id!).subscribe({
              next: () => { this.load(); this.showToast('Promotion supprimée', 'success'); },
              error: e => this.showToast(e.message, 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  ouvrirWhatsApp(promo: Promotion): void {
    this.loadingWA = true;
    this.showWAModal = true;
    this.whatsAppResult = null;
    this.searchWA = '';
    this.autoEnvoi = false;
    this.envoiEnCours = false;
    this.envoiIndex = 0;
    this.promotionService.preparerWhatsApp(promo.id!).subscribe({
      next: (result) => { this.whatsAppResult = result; this.loadingWA = false; },
      error: e => { this.loadingWA = false; this.showWAModal = false; this.showToast(e.message, 'danger'); }
    });
  }

  fermerWhatsApp(): void {
    this.showWAModal = false;
    this.whatsAppResult = null;
    this.envoiEnCours = false;
  }

  get liensFiltered(): WhatsAppLien[] {
    if (!this.whatsAppResult) return [];
    const q = this.searchWA.toLowerCase().trim();
    if (!q) return this.whatsAppResult.liens;
    return this.whatsAppResult.liens.filter(l =>
      l.nom.toLowerCase().includes(q) || l.telephone.includes(q)
    );
  }

  /** Enrichit l'URL WhatsApp avec signature boutique + label PROMOTION */
  enrichirUrl(url: string): string {
    try {
      const shop = this.boutiqueService.getInfo();
      const urlObj = new URL(url);
      const rawText = urlObj.searchParams.get('text') || '';
      const sig = [
        '',
        '━━━━━━━━━━━━━━━',
        `🏪 *${shop.nom || 'Boutique'}*`,
        shop.telephone ? `📞 ${shop.telephone}` : null,
        shop.adresse   ? `📍 ${shop.adresse}${shop.ville ? ', ' + shop.ville : ''}` : null,
        shop.email     ? `✉ ${shop.email}` : null,
      ].filter(Boolean).join('\n');

      const enhanced = `🎁 *PROMOTION SPÉCIALE* 🎁\n\n${rawText}${sig}`;
      urlObj.searchParams.set('text', enhanced);
      return urlObj.toString();
    } catch {
      return url;
    }
  }

  /** Envoi automatique : ouvre les liens WhatsApp un par un avec délai */
  async lancerEnvoiAuto(): Promise<void> {
    const liens = this.liensFiltered;
    if (liens.length === 0) return;

    this.envoiEnCours = true;
    this.envoiIndex = 0;

    for (let i = 0; i < liens.length; i++) {
      this.envoiIndex = i + 1;
      const url = this.enrichirUrl(liens[i].url);
      window.open(url, '_blank');
      if (i < liens.length - 1) {
        await new Promise<void>(r => setTimeout(r, 1500));
      }
    }

    this.envoiEnCours = false;
    this.showToast(`${liens.length} message(s) envoyé(s) !`, 'success');
  }

  getStatut(promo: Promotion): { label: string; color: string } {
    return this.promotionService.getStatut(promo);
  }

  private emptyForm(): Partial<Promotion> {
    return {
      titre: '',
      description: '',
      dateDebut: this.today,
      dateFin: '',
      typeReduction: 'POURCENTAGE',
      valeurReduction: undefined,
      active: true,
      globale: false,
      produitIds: []
    };
  }

  formatPrice(v: number): string { return this.promotionService.formatPrice(v); }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2500, position: 'bottom' });
    await toast.present();
  }
}
