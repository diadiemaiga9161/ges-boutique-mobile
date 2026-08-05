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
  selectedPeriod: 'today' | 'week' | 'month' | 'year' | 'all' = 'all';

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
    this.charger();
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

  filterByPeriod(period: 'today' | 'week' | 'month' | 'year' | 'all'): void {
    this.selectedPeriod = period;
    if (period === 'all') {
      this.dateDebut = '';
      this.dateFin = '';
      this.charger();
      return;
    }
    const today = new Date();
    this.dateFin = today.toISOString().split('T')[0];
    if (period === 'today') {
      this.dateDebut = this.dateFin;
    } else if (period === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      this.dateDebut = d.toISOString().split('T')[0];
    } else if (period === 'month') {
      this.dateDebut = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    } else {
      this.dateDebut = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
    }
    this.charger();
  }

  countByType(type: string): number {
    return this.sorties.filter(s => s.typeSortie === type).length;
  }

  resetFiltres(): void {
    this.typeSortieFilter = '';
    this.produitFilter = '';
    this.dateDebut = '';
    this.dateFin = '';
    this.searchTerm = '';
    this.selectedPeriod = 'all';
    this.charger();
  }

  getTypeSortieColor(type: string): string {
    const t = this.typesSortie.find(x => x.value === type);
    return t?.color || 'medium';
  }

  money(v: number): string { return this.inventaireService.formatPrice(v); }
  formatDate(d: string): string { return this.inventaireService.formatDateTimeForDisplay(d); }

  totalQuantite(): number {
    return this.sortiesFiltrees.reduce((sum, s) => sum + (s.quantite || 0), 0);
  }
}
