import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import {
  CalculPrimes,
  CommissionService,
  PaiementCommission,
  PrimeVendeur,
  RegleCommission,
  RegleCommissionRequest,
  TypeCommission,
  TypeParametre
} from '../../services/commission.service';
import { ProductService } from '../../services/product.service';
import { ConfirmSheetService } from '../../services/confirm-sheet.service';

type Onglet = 'vendeurs' | 'regles' | 'paiements';
type Periode = 'mois' | 'mois-dernier' | 'annee';

interface FormRegle {
  id: number | null;
  type: TypeCommission;
  cible: 'produit' | 'categorie';
  produitId: number | null;
  categorieId: number | null;
  valeur: number | null;
  quantiteObjectif: number | null;
  dateDebut: string;
  dateFin: string;
  vendeurId: number | null;
  nom: string;
}

/** Primes sur produits (fonctionnalité PRIMES_PRODUITS) — même logique que la page web. */
@Component({
  selector: 'app-primes-produits',
  templateUrl: './primes-produits.page.html',
  styleUrls: ['./primes-produits.page.scss'],
  standalone: false
})
export class PrimesProduitsPage implements OnInit {
  onglet: Onglet = 'vendeurs';
  periode: Periode = 'mois';
  debut = '';
  fin = '';

  calcul: CalculPrimes | null = null;
  regles: RegleCommission[] = [];
  paiements: PaiementCommission[] = [];
  types: TypeParametre[] = [];
  produits: { id: number; nom: string; uniteBase?: string }[] = [];
  categories: { id: number; nom: string }[] = [];
  vendeurs: { id: number; nomComplet: string }[] = [];

  chargement = true;
  erreur = '';
  ouvert: number | null = null;
  formRegle: FormRegle | null = null;
  rechercheProduit = '';
  enregistrement = false;

  readonly libellesTypes: Record<TypeCommission, { titre: string; exemple: string; icone: string }> = {
    MONTANT_FIXE: { titre: 'Montant par unité', exemple: '100 FCFA par carton vendu', icone: 'cash-outline' },
    POURCENTAGE: { titre: 'Pourcentage', exemple: '5 % du montant vendu', icone: 'trending-up-outline' },
    OBJECTIF: { titre: 'Objectif', exemple: '10 000 FCFA s\'il vend 50 sacs', icone: 'flag-outline' }
  };

  constructor(
    public cs: CommissionService,
    private productService: ProductService,
    private confirmSheet: ConfirmSheetService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    this.choisirPeriode('mois');
    this.cs.parametres().subscribe({ next: p => this.types = p.types, error: () => {} });
    this.cs.vendeurs().subscribe({ next: v => this.vendeurs = v, error: () => {} });
    this.productService.getProducts().subscribe({
      next: (p: any[]) => this.produits = (p || []).map(x => ({ id: x.id, nom: x.nom, uniteBase: x.uniteBase }))
        .sort((a, b) => a.nom.localeCompare(b.nom)),
      error: () => {}
    });
    this.productService.getAllCategories().subscribe({
      next: (c: any[]) => this.categories = (c || []).map(x => ({ id: x.id, nom: x.nom })),
      error: () => {}
    });
    this.chargerRegles();
    this.chargerPaiements();
  }

  rafraichir(ev: any): void {
    this.chargerCalcul();
    this.chargerRegles();
    this.chargerPaiements();
    setTimeout(() => ev?.target?.complete(), 600);
  }

  chargerRegles(): void {
    this.cs.regles().subscribe({ next: r => this.regles = r, error: () => {} });
  }

  chargerPaiements(): void {
    this.cs.paiements().subscribe({ next: p => this.paiements = p, error: () => {} });
  }

  chargerCalcul(): void {
    this.chargement = true;
    this.erreur = '';
    this.cs.primes(this.debut, this.fin).subscribe({
      next: c => { this.calcul = c; this.chargement = false; },
      error: err => {
        this.chargement = false;
        this.erreur = err?.error?.message || 'Impossible de calculer les primes.';
      }
    });
  }

  choisirPeriode(p: Periode): void {
    this.periode = p;
    const auj = new Date();
    if (p === 'mois') {
      this.debut = CommissionService.iso(new Date(auj.getFullYear(), auj.getMonth(), 1));
      this.fin = CommissionService.iso(new Date(auj.getFullYear(), auj.getMonth() + 1, 0));
    } else if (p === 'mois-dernier') {
      this.debut = CommissionService.iso(new Date(auj.getFullYear(), auj.getMonth() - 1, 1));
      this.fin = CommissionService.iso(new Date(auj.getFullYear(), auj.getMonth(), 0));
    } else {
      this.debut = CommissionService.iso(new Date(auj.getFullYear(), 0, 1));
      this.fin = CommissionService.iso(new Date(auj.getFullYear(), 11, 31));
    }
    this.chargerCalcul();
  }

  get typesActifs(): TypeParametre[] {
    return this.types.filter(t => t.actif);
  }

  basculerDetail(v: PrimeVendeur): void {
    this.ouvert = this.ouvert === v.vendeurId ? null : v.vendeurId;
  }

  cible(r: RegleCommission): string {
    return r.produitNom || (r.categorieNom ? `Catégorie ${r.categorieNom}` : '—');
  }

  libelleStatut(s: string): string {
    return s === 'EN_COURS' ? 'En cours' : s === 'A_VENIR' ? 'À venir' : 'Terminée';
  }

  // ---------------------------------------------------------------- règles

  nouvelleRegle(): void {
    const type = this.typesActifs[0]?.type || 'MONTANT_FIXE';
    const auj = new Date();
    this.rechercheProduit = '';
    this.formRegle = {
      id: null, type, cible: 'produit', produitId: null, categorieId: null, valeur: null, quantiteObjectif: null,
      dateDebut: CommissionService.iso(auj),
      dateFin: type === 'OBJECTIF' ? CommissionService.iso(new Date(auj.getFullYear(), auj.getMonth() + 1, 0)) : '',
      vendeurId: null, nom: ''
    };
  }

  modifierRegle(r: RegleCommission): void {
    this.rechercheProduit = '';
    this.formRegle = {
      id: r.id, type: r.type, cible: r.produitId ? 'produit' : 'categorie',
      produitId: r.produitId ?? null, categorieId: r.categorieId ?? null,
      valeur: r.valeur, quantiteObjectif: r.quantiteObjectif ?? null,
      dateDebut: r.dateDebut, dateFin: r.dateFin || '', vendeurId: r.vendeurId ?? null, nom: r.nom
    };
  }

  choisirType(t: TypeCommission): void {
    if (!this.formRegle) return;
    this.formRegle.type = t;
    if (t === 'OBJECTIF' && !this.formRegle.dateFin) {
      const d = new Date();
      this.formRegle.dateFin = CommissionService.iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    }
  }

  get produitsFiltres() {
    const q = this.rechercheProduit.trim().toLowerCase();
    const liste = q ? this.produits.filter(p => p.nom.toLowerCase().includes(q)) : this.produits;
    const choisi = this.produits.find(p => p.id === this.formRegle?.produitId);
    return choisi && !liste.includes(choisi) ? [choisi, ...liste.slice(0, 99)] : liste.slice(0, 100);
  }

  get uniteChoisie(): string {
    const p = this.produits.find(x => x.id === this.formRegle?.produitId);
    return (p?.uniteBase || 'unité').toLowerCase();
  }

  enregistrerRegle(): void {
    const f = this.formRegle;
    if (!f) return;
    const valeur = f.valeur != null ? Number(f.valeur) : null;
    const erreur =
      f.cible === 'produit' && !f.produitId ? 'Choisissez le produit.' :
      f.cible === 'categorie' && !f.categorieId ? 'Choisissez la catégorie.' :
      !valeur || valeur <= 0 ? 'Indiquez le montant de la prime.' :
      f.type === 'POURCENTAGE' && valeur > 100 ? 'Le pourcentage ne peut pas dépasser 100.' :
      f.type === 'OBJECTIF' && (!f.quantiteObjectif || f.quantiteObjectif <= 0) ? 'Indiquez la quantité à vendre.' :
      f.type === 'OBJECTIF' && !f.dateFin ? 'Une prime sur objectif a besoin d\'une date de fin.' :
      f.dateFin && f.dateFin < f.dateDebut ? 'La date de fin doit être après la date de début.' : '';
    if (erreur) { this.toast(erreur, 'warning'); return; }
    const req: RegleCommissionRequest = {
      nom: f.nom.trim() || undefined,
      type: f.type,
      produitId: f.cible === 'produit' ? f.produitId : null,
      categorieId: f.cible === 'categorie' ? f.categorieId : null,
      valeur,
      quantiteObjectif: f.type === 'OBJECTIF' ? Number(f.quantiteObjectif) : null,
      dateDebut: f.dateDebut,
      dateFin: f.dateFin || null,
      vendeurId: f.vendeurId
    };
    this.enregistrement = true;
    const obs = f.id ? this.cs.modifierRegle(f.id, req) : this.cs.creerRegle(req);
    obs.subscribe({
      next: () => {
        this.enregistrement = false;
        this.formRegle = null;
        this.toast('Condition enregistrée', 'success');
        this.chargerRegles();
        this.chargerCalcul();
      },
      error: err => {
        this.enregistrement = false;
        this.toast(err?.error?.message || 'Enregistrement impossible.', 'danger');
      }
    });
  }

  async arreterRegle(r: RegleCommission): Promise<void> {
    const ok = await this.confirmSheet.confirm({
      title: `Arrêter « ${r.nom} » ?`,
      message: 'La condition s\'arrête aujourd\'hui. Les primes déjà gagnées restent dues.',
      confirmLabel: 'Arrêter'
    });
    if (!ok) return;
    this.cs.arreterRegle(r.id).subscribe({
      next: () => { this.chargerRegles(); this.chargerCalcul(); },
      error: err => this.toast(err?.error?.message || 'Impossible.', 'danger')
    });
  }

  async supprimerRegle(r: RegleCommission): Promise<void> {
    const ok = await this.confirmSheet.confirm({
      title: `Supprimer « ${r.nom} » ?`,
      message: 'Les primes calculées avec cette condition disparaîtront aussi des totaux. Pour garder l\'historique, utilisez plutôt « Arrêter ».',
      confirmLabel: 'Supprimer', danger: true
    });
    if (!ok) return;
    this.cs.supprimerRegle(r.id).subscribe({
      next: () => { this.chargerRegles(); this.chargerCalcul(); },
      error: err => this.toast(err?.error?.message || 'Impossible.', 'danger')
    });
  }

  // ---------------------------------------------------------------- paiements

  async payer(v: PrimeVendeur): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: `Payer ${v.vendeurNom}`,
      subHeader: `Reste à payer : ${this.cs.fmt(v.resteAPayer)}`,
      inputs: [
        { name: 'montant', type: 'number', value: Math.round(v.resteAPayer), placeholder: 'Montant versé (FCFA)', min: 1 },
        { name: 'note', type: 'text', placeholder: 'Note (facultatif)' }
      ],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Confirmer',
          handler: (d: { montant: string; note: string }) => {
            const montant = Number(d.montant);
            if (!montant || montant <= 0) { this.toast('Indiquez le montant versé.', 'warning'); return false; }
            this.cs.payer(v.vendeurId, montant, (d.note || '').trim() || undefined).subscribe({
              next: () => { this.toast('Paiement enregistré', 'success'); this.chargerCalcul(); this.chargerPaiements(); },
              error: err => this.toast(err?.error?.message || 'Enregistrement impossible.', 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async supprimerPaiement(p: PaiementCommission): Promise<void> {
    const ok = await this.confirmSheet.confirm({
      title: 'Supprimer ce paiement ?',
      message: `${this.cs.fmt(p.montant)} versé à ${p.vendeurNom}. Le montant redeviendra « à payer ».`,
      confirmLabel: 'Supprimer', danger: true
    });
    if (!ok) return;
    this.cs.supprimerPaiement(p.id).subscribe({
      next: () => { this.chargerPaiements(); this.chargerCalcul(); },
      error: err => this.toast(err?.error?.message || 'Impossible.', 'danger')
    });
  }

  // ---------------------------------------------------------------- réglages

  async reglages(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Types de primes utilisés',
      message: 'Cochez seulement ce dont la boutique a besoin.',
      inputs: this.types.map(t => ({
        type: 'checkbox' as const, label: this.libellesTypes[t.type].titre, value: t.type, checked: t.actif
      })),
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Enregistrer',
          handler: (choisis: TypeCommission[]) => {
            if (!choisis?.length) { this.toast('Gardez au moins un type de prime.', 'warning'); return false; }
            this.cs.definirTypes(choisis).subscribe({
              next: p => { this.types = p.types; this.chargerRegles(); this.chargerCalcul(); },
              error: err => this.toast(err?.error?.message || 'Impossible.', 'danger')
            });
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async toast(message: string, color: 'success' | 'warning' | 'danger'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2200, position: 'bottom' });
    await t.present();
  }
}
