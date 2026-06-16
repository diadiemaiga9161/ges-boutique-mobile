import { Component, OnInit } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { TransfertService, BoutiquePartenaire } from '../../services/transfert.service';

@Component({
  selector: 'app-config-transferts',
  templateUrl: './config-transferts.page.html',
  styleUrls: ['./config-transferts.page.scss'],
  standalone: false,
})
export class ConfigTransfertsPage implements OnInit {

  partenaires: BoutiquePartenaire[] = [];
  isLoading = false;
  afficherForm = false;

  form: BoutiquePartenaire = { nom: '', url: '', actif: true };
  editing: BoutiquePartenaire | null = null;

  constructor(
    private transfertService: TransfertService,
    private toast: ToastController,
    private alert: AlertController
  ) {}

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.isLoading = true;
    this.transfertService.getPartenaires().subscribe({
      next: p => { this.partenaires = p; this.isLoading = false; },
      error: () => this.isLoading = false
    });
  }

  nouveau(): void {
    this.editing = null;
    this.form = { nom: '', url: '', actif: true };
    this.afficherForm = true;
  }

  editer(p: BoutiquePartenaire): void {
    this.editing = p;
    this.form = { ...p };
    this.afficherForm = true;
  }

  annuler(): void { this.afficherForm = false; }

  sauvegarder(): void {
    if (!this.form.nom.trim() || !this.form.url.trim()) return;
    const obs = this.editing?.id
      ? this.transfertService.modifierPartenaire(this.editing.id, this.form)
      : this.transfertService.ajouterPartenaire(this.form);

    obs.subscribe({
      next: () => {
        this.showToast(this.editing ? 'Partenaire modifié' : 'Partenaire ajouté', 'success');
        this.afficherForm = false;
        this.charger();
      },
      error: () => this.showToast('Erreur lors de la sauvegarde', 'danger')
    });
  }

  async confirmerSuppression(p: BoutiquePartenaire): Promise<void> {
    const alert = await this.alert.create({
      header: 'Supprimer',
      message: `Supprimer la boutique "${p.nom}" ?`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Supprimer', role: 'destructive', handler: () => this.supprimer(p) }
      ]
    });
    await alert.present();
  }

  supprimer(p: BoutiquePartenaire): void {
    if (!p.id) return;
    this.transfertService.supprimerPartenaire(p.id).subscribe({
      next: () => { this.showToast('Partenaire supprimé', 'success'); this.charger(); },
      error: () => this.showToast('Erreur lors de la suppression', 'danger')
    });
  }

  private async showToast(msg: string, color: string): Promise<void> {
    const t = await this.toast.create({ message: msg, duration: 2000, color, position: 'top' });
    await t.present();
  }
}
