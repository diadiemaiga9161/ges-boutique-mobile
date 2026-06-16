import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Depense, DepenseRequest, DepenseService } from '../../services/depense.service';

@Component({
  selector: 'app-depenses',
  templateUrl: './depenses.page.html',
  styleUrls: ['./depenses.page.scss'],
  standalone: false
})
export class DepensesPage implements OnInit {

  depenses: Depense[] = [];
  totalDepenses = 0;
  loading = false;
  showForm = false;
  editing: Depense | null = null;

  form: DepenseRequest = this.emptyForm();

  dateDebut = '';
  dateFin = '';

  constructor(
    private depenseService: DepenseService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: any): void {
    this.loading = true;
    this.depenseService.getAll().subscribe({
      next: ({ depenses, total }) => {
        this.depenses = depenses;
        this.totalDepenses = total;
        this.loading = false;
        event?.target?.complete();
      },
      error: e => {
        this.loading = false;
        event?.target?.complete();
        this.toast(e.message, 'danger');
      }
    });
  }

  filtrer(): void {
    if (!this.dateDebut || !this.dateFin) {
      this.toast('Veuillez saisir les deux dates', 'warning');
      return;
    }
    this.loading = true;
    this.depenseService.getParPeriode(this.dateDebut, this.dateFin).subscribe({
      next: ({ depenses, total }) => {
        this.depenses = depenses;
        this.totalDepenses = total;
        this.loading = false;
      },
      error: e => { this.loading = false; this.toast(e.message, 'danger'); }
    });
  }

  startCreate(): void {
    this.editing = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  startEdit(d: Depense): void {
    this.editing = d;
    this.form = { nom: d.nom, motif: d.motif || '', date: d.date, montant: d.montant };
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
        this.toast(this.editing ? 'Dépense modifiée — caisse ajustée' : 'Dépense créée — déduite de la caisse');
      },
      error: e => this.toast(e.message, 'danger')
    });
  }

  async supprimer(d: Depense): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Supprimer cette dépense ?',
      message: `${d.nom} — ${this.money(d.montant)} (remis en caisse)`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Supprimer', role: 'destructive',
          handler: () => {
            this.depenseService.supprimer(d.id!).subscribe({
              next: () => { this.load(); this.toast('Dépense supprimée — montant remis en caisse'); },
              error: e => this.toast(e.message, 'danger')
            });
          }
        }
      ]
    });
    await alert.present();
  }

  money(v: number): string {
    return this.depenseService.formatPrice(v);
  }

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  private emptyForm(): DepenseRequest {
    return { nom: '', motif: '', date: this.today, montant: 0 };
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2500, position: 'top' });
    await t.present();
  }
}
