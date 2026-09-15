import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { InventaireService, MouvementStock, TypeSortie, SortiesFilter } from '../../services/inventaire.service';

@Component({
  selector: 'app-sorties',
  templateUrl: './sorties.page.html',
  styleUrls: ['./sorties.page.scss'],
  standalone: false
})
export class SortiesPage {
  sorties: MouvementStock[] = [];
  sortiesFiltrees: MouvementStock[] = [];
  loading = false;

  // Filtres
  typeSortieFilter = '';
  produitFilter = '';
  dateDebut = '';
  dateFin = '';
  searchTerm = '';
  // 'custom' : dates saisies manuellement (champs Du/Au) — aucun chip de préréglage
  // n'est alors mis en évidence, mais ce n'est pas un mode "tout afficher" : dateDebut/
  // dateFin restent renseignées avec les valeurs choisies par l'utilisateur.
  selectedPeriod: 'today' | 'week' | 'month' | 'custom' = 'today';

  TypeSortie = TypeSortie;
  trackById = (_: number, item: any) => item.id;

  readonly typesSortie = [
    { value: 'DETAIL', label: 'Détail/Vente', color: 'primary' },
    { value: 'CONSOMMATION', label: 'Consommation', color: 'warning' },
    { value: 'UTILISATION', label: 'Utilisation', color: 'tertiary' },
    { value: 'PERTE', label: 'Perte', color: 'danger' },
    { value: 'AUTRE', label: 'Autre', color: 'medium' }
  ];

  constructor(
    public inventaireService: InventaireService,
    private toastCtrl: ToastController
  ) {}

  ionViewWillEnter(): void {
    // filterByPeriod('today') plutôt que charger() nu : calcule et applique la
    // borne de date du jour (dateDebut/dateFin étaient sinon vides = "tout").
    this.filterByPeriod('today');
  }

  charger(event?: any): void {
    this.loading = true;
    const filters: SortiesFilter = {};
    if (this.typeSortieFilter) filters.typeSortie = this.typeSortieFilter;
    if (this.dateDebut) filters.dateDebut = this.dateDebut;
    if (this.dateFin) filters.dateFin = this.dateFin;

    this.inventaireService.getSorties(filters).subscribe({
      next: sorties => {
        this.sorties = sorties;
        this.appliquerFiltres();
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.loading = false;
        event?.target?.complete();
      }
    });
  }

  appliquerFiltres(): void {
    let filtered = [...this.sorties];

    if (this.typeSortieFilter) {
      filtered = filtered.filter(s => s.typeSortie === this.typeSortieFilter);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        (s.produit?.nom || '').toLowerCase().includes(term) ||
        (s.motif || '').toLowerCase().includes(term) ||
        (s.utilisateur?.nomComplet || '').toLowerCase().includes(term)
      );
    }

    this.sortiesFiltrees = filtered;
  }

  filterByPeriod(period: 'today' | 'week' | 'month'): void {
    this.selectedPeriod = period;
    const today = new Date();
    this.dateFin = today.toISOString().split('T')[0];
    if (period === 'today') {
      this.dateDebut = this.dateFin;
    } else if (period === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      this.dateDebut = d.toISOString().split('T')[0];
    } else {
      this.dateDebut = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    }
    this.charger();
  }

  countByType(type: string): number {
    return this.sorties.filter(s => s.typeSortie === type).length;
  }

  resetFiltres(): void {
    this.typeSortieFilter = '';
    this.produitFilter = '';
    this.searchTerm = '';
    this.filterByPeriod('today');
  }

  getTypeSortieColor(type: string): string {
    const t = this.typesSortie.find(x => x.value === type);
    return t?.color || 'medium';
  }

  // Affichage uniquement (design commun) : teinte de pastille et icône par type de sortie.
  toneTypeSortie(type: string): 'info' | 'warn' | 'bad' | 'neutral' {
    if (type === 'DETAIL') return 'info';
    if (type === 'CONSOMMATION') return 'warn';
    if (type === 'PERTE') return 'bad';
    return 'neutral';
  }

  iconeTypeSortie(type: string): string {
    const icones: Record<string, string> = {
      DETAIL: 'cart-outline',
      CONSOMMATION: 'restaurant-outline',
      UTILISATION: 'construct-outline',
      PERTE: 'alert-circle-outline',
      AUTRE: 'ellipsis-horizontal-outline'
    };
    return icones[type] || 'ellipsis-horizontal-outline';
  }

  money(v: number): string { return this.inventaireService.formatPrice(v); }
  formatDate(d: string): string { return this.inventaireService.formatDateTimeForDisplay(d); }

  totalQuantite(): number {
    return this.sortiesFiltrees.reduce((sum, s) => sum + (s.quantite || 0), 0);
  }
}
