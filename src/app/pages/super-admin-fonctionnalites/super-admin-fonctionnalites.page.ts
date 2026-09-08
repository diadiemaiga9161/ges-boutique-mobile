import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { BoutiqueService, FonctionnaliteAvancee } from '../../services/boutique.service';
import { AuthService } from '../../services/auth.service';

// Page réservée au super admin (flag super_admin en base sur un compte ADMIN
// existant — voir AuthGuard data: { superAdminOnly: true } et AuthService.isSuperAdmin).
// Le serveur revérifie systématiquement le privilège sur PUT /api/boutique/fonctionnalites.
@Component({
  selector: 'app-super-admin-fonctionnalites',
  templateUrl: './super-admin-fonctionnalites.page.html',
  styleUrls: ['./super-admin-fonctionnalites.page.scss'],
  standalone: false
})
export class SuperAdminFonctionnalitesPage implements OnInit {
  featureTransfertsActif = true;
  featureVitrineActif = true;
  loading = false;
  saving = false;

  // Fonctionnalités avancées — système séparé, chaque bascule se sauvegarde
  // immédiatement (pas de bouton "Enregistrer" groupé).
  fonctionnalitesAvancees: FonctionnaliteAvancee[] = [];
  loadingAvancees = false;
  clesEnCours = new Set<string>();

  private readonly icones: Record<string, string> = {
    DEPOT_GARDE: 'lock-closed-outline',
    DETTES_ANCIENNES: 'document-text-outline',
    COMPTES_BANCAIRES: 'card-outline',
    PROMOTIONS: 'pricetag-outline',
    MOBILE_MONEY: 'phone-portrait-outline',
    BONUS_FOURNISSEURS: 'gift-outline',
    OBJECTIFS_FOURNISSEUR: 'trophy-outline',
    OBJECTIFS_VENDEUR: 'cash-outline',
    RAPPORTS: 'stats-chart-outline',
    IA: 'sparkles-outline',
    RESULTAT_NET: 'analytics-outline'
  };

  private readonly descriptions: Record<string, string> = {
    DEPOT_GARDE: "Bloque les nouveaux dépôts — les clients gardent l'accès à leur historique et récupèrent toujours leur argent.",
    DETTES_ANCIENNES: 'Bloque la création de nouvelles dettes — règlement et consultation restent ouverts.',
    COMPTES_BANCAIRES: 'Gestion des comptes bancaires de la boutique.',
    PROMOTIONS: 'Création et envoi de promotions aux clients.',
    MOBILE_MONEY: 'Statistiques Orange Money / Moov Money.',
    BONUS_FOURNISSEURS: 'Suivi des bonus accordés par les fournisseurs.',
    OBJECTIFS_FOURNISSEUR: 'Objectifs et bonus liés aux fournisseurs.',
    OBJECTIFS_VENDEUR: 'Primes des vendeurs selon leurs objectifs.',
    RAPPORTS: 'Page de rapports et statistiques analytiques.',
    IA: 'Assistant et recommandations intelligentes.',
    RESULTAT_NET: 'Calcul du résultat net (bénéfice/perte).'
  };

  getIcone(cle: string): string {
    return this.icones[cle] || 'toggle-outline';
  }

  getDescription(cle: string): string {
    return this.descriptions[cle] || '';
  }

  constructor(
    private boutiqueService: BoutiqueService,
    private auth: AuthService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.boutiqueService.refreshBoutique().subscribe({
      next: (info) => {
        this.featureTransfertsActif = info.featureTransfertsActif !== false;
        this.featureVitrineActif = info.featureVitrineActif !== false;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });

    this.loadingAvancees = true;
    this.boutiqueService.chargerFonctionnalitesAvancees().subscribe({
      next: (liste) => { this.fonctionnalitesAvancees = liste; this.loadingAvancees = false; },
      error: () => { this.loadingAvancees = false; }
    });
  }

  enregistrer(): void {
    this.saving = true;
    this.boutiqueService.modifierFonctionnalites(this.featureTransfertsActif, this.featureVitrineActif).subscribe({
      next: async () => {
        this.saving = false;
        const toast = await this.toastCtrl.create({ message: 'Fonctionnalités mises à jour', color: 'success', duration: 2000, position: 'top' });
        await toast.present();
      },
      error: async (err) => {
        this.saving = false;
        const toast = await this.toastCtrl.create({ message: err.message || 'Erreur lors de la mise à jour', color: 'danger', duration: 2500, position: 'top' });
        await toast.present();
      }
    });
  }

  basculerFonctionnaliteAvancee(f: FonctionnaliteAvancee): void {
    const nouvelEtat = !f.actif;
    this.clesEnCours.add(f.cle);
    this.boutiqueService.definirFonctionnaliteAvancee(f.cle, nouvelEtat).subscribe({
      next: (liste) => {
        this.fonctionnalitesAvancees = liste;
        this.clesEnCours.delete(f.cle);
      },
      error: async (err) => {
        this.clesEnCours.delete(f.cle);
        const toast = await this.toastCtrl.create({ message: err.message || 'Erreur lors de la mise à jour', color: 'danger', duration: 2500, position: 'top' });
        await toast.present();
      }
    });
  }
}
