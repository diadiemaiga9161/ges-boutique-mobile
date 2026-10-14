import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Produit, ProductService } from '../../services/product.service';
import { OffreQuantite, OffreQuantiteService } from '../../services/offre-quantite.service';

interface Saisie {
  id?: number;
  produitId: number | null;
  quantite: number | null;
  prix: number | null;
  dateDebut: string;
  dateFin: string;
  active: boolean;
}

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
  chargement = false;
  enregistrement = false;
  message = '';
  erreur = '';
  saisie: Saisie | null = null;

  constructor(private service: OffreQuantiteService, private productService: ProductService,
              private alertCtrl: AlertController) {}

  ionViewWillEnter(): void {
    this.charger();
    if (!this.produits.length) {
      this.productService.getProducts().subscribe({
        next: p => (this.produits = p.filter(x => !x.modeMesure).sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))),
        error: () => {}
      });
    }
  }

  charger(event?: any): void {
    this.chargement = true;
    this.service.lister().subscribe({
      next: o => { this.offres = o; this.chargement = false; event?.target?.complete(); },
      error: e => {
        this.erreur = e?.error?.message || 'Impossible de charger les offres.';
        this.chargement = false;
        event?.target?.complete();
      }
    });
  }

  get produitsFiltres(): Produit[] {
    const r = this.recherche.trim().toLowerCase();
    return (r ? this.produits.filter(p => (p.nom || '').toLowerCase().includes(r) || (p.codeBarre || '').includes(r)) : this.produits).slice(0, 30);
  }

  get produitChoisi(): Produit | undefined {
    return this.produits.find(p => p.id === this.saisie?.produitId);
  }

  get apercu(): { normal: number; economie: number; perte: boolean } | null {
    const p = this.produitChoisi;
    const s = this.saisie;
    if (!p || !s?.quantite || !s.prix) return null;
    const normal = s.quantite * (p.prixVente || 0);
    return { normal, economie: normal - s.prix, perte: s.prix < s.quantite * (p.prixAchat || 0) };
  }

  nouvelle(): void {
    this.message = '';
    this.erreur = '';
    this.recherche = '';
    this.saisie = { produitId: null, quantite: 2, prix: null, dateDebut: '', dateFin: '', active: true };
  }

  modifier(o: OffreQuantite): void {
    this.message = '';
    this.erreur = '';
    this.saisie = { id: o.id, produitId: o.produitId, quantite: o.quantite, prix: o.prix,
      dateDebut: o.dateDebut || '', dateFin: o.dateFin || '', active: o.active };
  }

  enregistrer(): void {
    if (!this.saisie) return;
    this.enregistrement = true;
    this.erreur = '';
    this.service.enregistrer({
      id: this.saisie.id,
      produitId: this.saisie.produitId ?? undefined,
      quantite: this.saisie.quantite ?? undefined,
      prix: this.saisie.prix ?? undefined,
      dateDebut: this.saisie.dateDebut || null,
      dateFin: this.saisie.dateFin || null,
      active: this.saisie.active
    }).subscribe({
      next: o => {
        this.message = `Offre enregistrée : ${o.produitNom}, ${o.quantite} pour ${this.prix(o.prix)}.`;
        this.saisie = null;
        this.enregistrement = false;
        this.charger();
      },
      error: e => { this.erreur = e?.error?.message || 'Enregistrement impossible.'; this.enregistrement = false; }
    });
  }

  basculer(o: OffreQuantite): void {
    this.erreur = '';
    this.service.enregistrer({ ...o, active: !o.active }).subscribe({
      next: () => { this.message = o.active ? 'Offre arrêtée.' : 'Offre remise en marche.'; this.charger(); },
      error: e => (this.erreur = e?.error?.message || 'Modification impossible.')
    });
  }

  async supprimer(o: OffreQuantite): Promise<void> {
    const alerte = await this.alertCtrl.create({
      header: 'Supprimer l\'offre ?',
      message: `${o.quantite} pour ${this.prix(o.prix)} sur ${o.produitNom}`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', cssClass: 'alert-btn-danger',
          handler: () => this.service.supprimer(o.id).subscribe({
            next: () => { this.message = 'Offre supprimée.'; this.charger(); },
            error: e => (this.erreur = e?.error?.message || 'Suppression impossible.')
          })
        }
      ]
    });
    await alerte.present();
  }

  etat(o: OffreQuantite): string {
    if (!o.active) return 'Arrêtée';
    return o.enCours ? 'En cours' : 'Programmée / finie';
  }

  prix(v: number): string {
    return Math.round(v || 0).toLocaleString('fr-FR') + ' F';
  }
}
