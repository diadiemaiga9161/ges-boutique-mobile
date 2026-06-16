import { Component, OnInit } from '@angular/core';
import { BonusFournisseurService, ResultatNet } from '../../services/bonus-fournisseur.service';

type Periode = 'JOURNALIER' | 'MENSUEL' | 'ANNUEL';

@Component({
  selector: 'app-resultat-net',
  templateUrl: './resultat-net.page.html',
  styleUrls: ['./resultat-net.page.scss'],
  standalone: false
})
export class ResultatNetPage implements OnInit {

  periodeActive: Periode = 'MENSUEL';
  loading = false;
  data: ResultatNet | null = null;
  erreur = '';

  dateJour = new Date().toISOString().split('T')[0];
  moisSelect = new Date().getMonth() + 1;
  anneeSelect = new Date().getFullYear();

  annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  mois = [
    { v: 1, l: 'Jan' }, { v: 2, l: 'Fév' }, { v: 3, l: 'Mar' },
    { v: 4, l: 'Avr' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' },
    { v: 7, l: 'Jul' }, { v: 8, l: 'Aoû' }, { v: 9, l: 'Sep' },
    { v: 10, l: 'Oct'}, { v: 11, l: 'Nov'}, { v: 12, l: 'Déc' }
  ];

  constructor(private bonusService: BonusFournisseurService) {}

  ngOnInit(): void {}

  ionViewWillEnter(): void {
    this.charger();
  }

  selectionner(p: Periode): void {
    this.periodeActive = p;
    this.charger();
  }

  charger(): void {
    this.loading = true;
    this.erreur = '';
    this.data = null;

    const obs$ = this.periodeActive === 'JOURNALIER'
      ? this.bonusService.getResultatJournalier(this.dateJour)
      : this.periodeActive === 'MENSUEL'
      ? this.bonusService.getResultatMensuel(this.moisSelect, this.anneeSelect)
      : this.bonusService.getResultatAnnuel(this.anneeSelect);

    obs$.subscribe({
      next: d => { this.data = d; this.loading = false; },
      error: e => { this.erreur = e.message; this.loading = false; }
    });
  }

  money(v: number): string { return this.bonusService.formatPrice(v); }

  get pctBonus(): number {
    if (!this.data || this.data.benefices + this.data.bonusFournisseurs === 0) return 0;
    return Math.round((this.data.bonusFournisseurs / (this.data.benefices + this.data.bonusFournisseurs)) * 100);
  }

  get pctDepenses(): number {
    if (!this.data || this.data.benefices + this.data.bonusFournisseurs === 0) return 0;
    return Math.round((this.data.depenses / (this.data.benefices + this.data.bonusFournisseurs)) * 100);
  }
}
