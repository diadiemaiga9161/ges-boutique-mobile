import { Component, HostListener } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Produit, ProductService } from '../../services/product.service';
import { OffreQuantite, OffreQuantiteService } from '../../services/offre-quantite.service';
import { calculerOffre } from '../../utils/offres-quantite.util';

interface Saisie {
  id?: number;
  produitId: number | null;
  quantite: number;
  prix: number | null;
  limiterDates: boolean;
  dateDebut: string;
  dateFin: string;
  active: boolean;
}

interface GroupeProduit {
  produitId: number;
  produitNom: string;
  prixNormal: number;
  offres: OffreQuantite[];
}

type Filtre = 'toutes' | 'en-cours' | 'arretees';

/** Offres par quantité (« 2 pour 75 F ») : réglées par le gérant, appliquées par la caisse. */
@Component({
  selector: 'app-offres-quantite',
  templateUrl: './offres-quantite.page.html',
  styleUrls: ['./offres-quantite.page.scss'],
  standalone: false
})
export class OffresQuantitePage {
  offres: OffreQuantite[] = [];
  produits: Produit[] = [];
  recherche = '';
  filtre: Filtre = 'toutes';
  chargement = false;
  enregistrement = false;
  erreurFormulaire = '';
  saisie: Saisie | null = null;
  aideOuverte = false;

  constructor(private service: OffreQuantiteService, private productService: ProductService,
              private alertCtrl: AlertController, private toastCtrl: ToastController) {}

  ionViewWillEnter(): void {
    this.charger();
    if (!this.produits.length) {
      this.productService.getProducts().subscribe({
        next: p => (this.produits = p.filter(x => !x.modeMesure).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))),
        error: () => {}
      });
    }
  }

  @HostListener('document:keydown.escape')
  surEchap(): void {
    if (this.saisie) this.fermer();
  }

  charger(event?: any): void {
    this.chargement = true;
    this.service.lister().subscribe({
      next: o => {
        this.offres = o;
        this.chargement = false;
        this.aideOuverte = !o.length;
        event?.target?.complete();
      },
      error: e => {
        this.chargement = false;
        event?.target?.complete();
        this.toast(e?.error?.message || 'Impossible de charger les offres.', 'danger');
      }
    });
  }

  // ------------------------------------------------------------------ liste

  get nbEnCours(): number { return this.offres.filter(o => o.active && o.enCours).length; }
  get nbArretees(): number { return this.offres.filter(o => !o.active).length; }
  get nbProduits(): number { return new Set(this.offres.map(o => o.produitId)).size; }

  get groupes(): GroupeProduit[] {
    const visibles = this.offres.filter(o =>
      this.filtre === 'toutes' || (this.filtre === 'en-cours' ? o.active && o.enCours : !o.active));
    const map = new Map<number, GroupeProduit>();
    for (const o of visibles) {
      const g = map.get(o.produitId) || { produitId: o.produitId, produitNom: o.produitNom, prixNormal: o.prixNormal, offres: [] };
      g.offres.push(o);
      map.set(o.produitId, g);
    }
    return [...map.values()].sort((a, b) => a.produitNom.localeCompare(b.produitNom));
  }

  etat(o: OffreQuantite): { texte: string; classe: string } {
    if (!o.active) return { texte: 'Arrêtée', classe: 'arret' };
    if (o.enCours) return { texte: 'En cours', classe: 'actif' };
    return { texte: o.dateDebut && new Date(o.dateDebut) > new Date() ? 'Programmée' : 'Terminée', classe: 'attente' };
  }

  periode(o: OffreQuantite): string {
    if (!o.dateDebut && !o.dateFin) return 'Sans date de fin';
    if (o.dateDebut && o.dateFin) return `Du ${this.date(o.dateDebut)} au ${this.date(o.dateFin)}`;
    return o.dateDebut ? `À partir du ${this.date(o.dateDebut)}` : `Jusqu'au ${this.date(o.dateFin!)}`;
  }

  // ------------------------------------------------------------------ formulaire

  nouvelle(produitId?: number): void {
    this.erreurFormulaire = '';
    this.recherche = '';
    this.saisie = { produitId: produitId ?? null, quantite: 2, prix: null, limiterDates: false,
      dateDebut: '', dateFin: '', active: true };
  }

  modifier(o: OffreQuantite): void {
    this.erreurFormulaire = '';
    this.saisie = {
      id: o.id, produitId: o.produitId, quantite: o.quantite, prix: o.prix,
      limiterDates: !!(o.dateDebut || o.dateFin), dateDebut: o.dateDebut || '', dateFin: o.dateFin || '', active: o.active
    };
  }

  fermer(): void {
    this.saisie = null;
  }

  get produitsFiltres(): Produit[] {
    const r = this.recherche.trim().toLowerCase();
    return (r ? this.produits.filter(p => (p.nom || '').toLowerCase().includes(r) || (p.codeBarre || '').includes(r)) : this.produits).slice(0, 40);
  }

  get produitChoisi(): Produit | undefined {
    return this.produits.find(p => p.id === this.saisie?.produitId);
  }

  changerQuantite(delta: number): void {
    if (!this.saisie) return;
    this.saisie.quantite = Math.min(100, Math.max(2, (Number(this.saisie.quantite) || 2) + delta));
  }

  /** Prix normal du lot et gain du client pour la saisie en cours. */
  get apercu(): { normal: number; gain: number; perte: boolean; invalide: boolean } | null {
    const p = this.produitChoisi;
    const s = this.saisie;
    if (!p || !s?.quantite || !s.prix) return null;
    const normal = s.quantite * (p.prixVente || 0);
    return {
      normal,
      gain: normal - s.prix,
      perte: s.prix < s.quantite * (p.prixAchat || 0),
      invalide: s.prix >= normal
    };
  }

  /** Exemples de ce que paiera le client à la caisse avec cette offre. */
  get exemples(): { quantite: number; prix: number; normal: number }[] {
    const p = this.produitChoisi;
    const s = this.saisie;
    if (!p || !s?.quantite || !s.prix || !(p.prixVente > 0)) return [];
    const offre = [{ produitId: p.id, quantite: s.quantite, prix: s.prix }];
    const quantites = [...new Set([1, s.quantite, s.quantite + 1, s.quantite * 2])].sort((a, b) => a - b);
    return quantites.map(q => {
      const normal = q * p.prixVente;
      return { quantite: q, normal, prix: normal - calculerOffre(q, p.prixVente, offre).remise };
    });
  }

  get peutEnregistrer(): boolean {
    const a = this.apercu;
    return !!this.saisie?.produitId && !!this.saisie.quantite && !!this.saisie.prix && !!a && !a.invalide && !this.enregistrement;
  }

  enregistrer(): void {
    if (!this.saisie || !this.peutEnregistrer) return;
    this.enregistrement = true;
    this.erreurFormulaire = '';
    const s = this.saisie;
    this.service.enregistrer({
      id: s.id,
      produitId: s.produitId ?? undefined,
      quantite: s.quantite,
      prix: s.prix ?? undefined,
      dateDebut: s.limiterDates ? s.dateDebut || null : null,
      dateFin: s.limiterDates ? s.dateFin || null : null,
      active: s.active
    }).subscribe({
      next: o => {
        this.enregistrement = false;
        this.saisie = null;
        this.toast(`Offre enregistrée : ${o.quantite} ${o.produitNom} pour ${this.prix(o.prix)}`, 'success');
        this.charger();
      },
      error: e => {
        this.enregistrement = false;
        this.erreurFormulaire = e?.error?.message || 'Enregistrement impossible.';
      }
    });
  }

  basculer(o: OffreQuantite): void {
    this.service.enregistrer({ ...o, active: !o.active }).subscribe({
      next: () => { this.toast(o.active ? 'Offre arrêtée' : 'Offre remise en marche', 'success'); this.charger(); },
      error: e => this.toast(e?.error?.message || 'Modification impossible.', 'danger')
    });
  }

  async supprimer(o: OffreQuantite): Promise<void> {
    const alerte = await this.alertCtrl.create({
      header: 'Supprimer cette offre ?',
      message: `« ${o.quantite} pour ${this.prix(o.prix)} » sur ${o.produitNom}. Les ventes déjà faites ne changent pas.`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', cssClass: 'alert-btn-danger',
          handler: () => this.service.supprimer(o.id).subscribe({
            next: () => { this.toast('Offre supprimée', 'success'); this.charger(); },
            error: e => this.toast(e?.error?.message || 'Suppression impossible.', 'danger')
          })
        }
      ]
    });
    await alerte.present();
  }

  // ------------------------------------------------------------------ outils

  prix(v: number): string {
    return Math.round(v || 0).toLocaleString('fr-FR') + ' F';
  }

  private date(iso: string): string {
    const [a, m, j] = iso.split('-').map(Number);
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2500, position: 'top' });
    await t.present();
  }
}
