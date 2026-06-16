import { Component, OnInit } from '@angular/core';
import {
  BonusFournisseur,
  BonusFournisseurRequest,
  BonusFournisseurService,
  BonusStats,
  ResultatNet,
  TypeBonus
} from '../../services/bonus-fournisseur.service';
import { ProductService } from '../../services/product.service';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-bonus-fournisseurs',
  templateUrl: './bonus-fournisseurs.page.html',
  styleUrls: ['./bonus-fournisseurs.page.scss'],
  standalone: false
})
export class BonusFournisseursPage implements OnInit {

  bonus: BonusFournisseur[] = [];
  stats: BonusStats | null = null;
  resultat: ResultatNet | null = null;
  fournisseurs: any[] = [];

  loading = false;
  showForm = false;
  editingId: number | null = null;

  activeTab: 'liste' | 'resultat' = 'liste';

  form: BonusFournisseurRequest = this.emptyForm();

  readonly types: { value: TypeBonus; label: string; color: string }[] = [
    { value: 'RISTOURNE', label: 'Ristourne', color: 'success' },
    { value: 'BONUS_VOLUME', label: 'Bonus Volume', color: 'primary' },
    { value: 'PRIME_OBJECTIF', label: 'Prime Objectif', color: 'warning' },
    { value: 'BONUS_ACHAT', label: 'Bonus Achat', color: 'tertiary' }
  ];

  constructor(
    private bonusService: BonusFournisseurService,
    private productService: ProductService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadFournisseurs();
    this.loadStats();
    this.loadResultat();
  }

  load(event?: any): void {
    this.loading = true;
    this.bonusService.getAll().subscribe({
      next: data => {
        this.bonus = data;
        this.loading = false;
        event?.target?.complete();
      },
      error: () => { this.loading = false; event?.target?.complete(); }
    });
  }

  loadFournisseurs(): void {
    this.productService.getAllFournisseurs().subscribe({
      next: (d: any) => { this.fournisseurs = Array.isArray(d) ? d : []; },
      error: () => {}
    });
  }

  loadStats(): void {
    this.bonusService.getStatistiques().subscribe({
      next: s => this.stats = s,
      error: () => {}
    });
  }

  loadResultat(): void {
    this.bonusService.getResultatMensuel().subscribe({
      next: r => this.resultat = r,
      error: () => {}
    });
  }

  startCreate(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  startEdit(b: BonusFournisseur): void {
    this.editingId = b.id!;
    this.form = {
      fournisseurId: b.fournisseurId,
      type: b.type,
      montant: b.montant,
      date: b.date,
      description: b.description || ''
    };
    this.showForm = true;
  }

  save(): void {
    if (!this.form.fournisseurId || !this.form.type || !this.form.date) {
      this.toast('Fournisseur, type et date sont obligatoires', 'warning');
      return;
    }

    const obs = this.editingId
      ? this.bonusService.modifier(this.editingId, this.form)
      : this.bonusService.creer(this.form);

    obs.subscribe({
      next: () => {
        this.showForm = false;
        this.load();
        this.loadStats();
        this.loadResultat();
        this.toast(this.editingId ? 'Bonus modifié' : 'Bonus enregistré', 'success');
      },
      error: e => this.toast(e.message, 'danger')
    });
  }

  async supprimer(b: BonusFournisseur): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer ce bonus ?',
      message: `${b.typeLibelle || b.type} — ${this.money(b.montant)}`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', role: 'destructive',
          handler: () => {
            this.bonusService.supprimer(b.id!).subscribe({
              next: () => { this.load(); this.loadStats(); this.loadResultat(); },
              error: e => this.toast(e.message, 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  totalBonus(): number {
    return this.bonus.reduce((s, b) => s + b.montant, 0);
  }

  typeColor(type: TypeBonus): string {
    return this.types.find(t => t.value === type)?.color || 'medium';
  }

  money(v: number): string { return this.bonusService.formatPrice(v); }

  private emptyForm(): BonusFournisseurRequest {
    return {
      fournisseurId: 0,
      type: 'RISTOURNE',
      montant: 0,
      date: new Date().toISOString().split('T')[0],
      description: ''
    };
  }

  private async toast(msg: string, color: string): Promise<void> {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, color, position: 'top' });
    await t.present();
  }
}
