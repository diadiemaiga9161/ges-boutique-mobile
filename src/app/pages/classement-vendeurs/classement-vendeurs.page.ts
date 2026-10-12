import { Component, OnInit } from '@angular/core';
import { ClassementVendeurs, LigneClassementVendeur, RapportService } from '../../services/rapport.service';

type Periode = 'semaine' | 'mois' | 'mois-dernier';

/** Classement des vendeurs : réservé au gérant. */
@Component({
  selector: 'app-classement-vendeurs',
  templateUrl: './classement-vendeurs.page.html',
  styleUrls: ['./classement-vendeurs.page.scss'],
  standalone: false
})
export class ClassementVendeursPage implements OnInit {
  periode: Periode = 'mois';
  chargement = false;
  erreur = '';
  donnees: ClassementVendeurs | null = null;

  readonly periodes: { cle: Periode; libelle: string }[] = [
    { cle: 'semaine', libelle: 'Cette semaine' },
    { cle: 'mois', libelle: 'Ce mois-ci' },
    { cle: 'mois-dernier', libelle: 'Mois dernier' }
  ];

  constructor(private rapportService: RapportService) {}

  ngOnInit(): void {
    this.charger();
  }

  choisir(p: Periode): void {
    this.periode = p;
    this.charger();
  }

  charger(event?: any): void {
    const auj = new Date();
    let debut: Date;
    let fin = auj;
    if (this.periode === 'semaine') {
      debut = new Date(auj);
      debut.setDate(auj.getDate() - ((auj.getDay() + 6) % 7));
    } else if (this.periode === 'mois-dernier') {
      debut = new Date(auj.getFullYear(), auj.getMonth() - 1, 1);
      fin = new Date(auj.getFullYear(), auj.getMonth(), 0);
    } else {
      debut = new Date(auj.getFullYear(), auj.getMonth(), 1);
    }
    this.chargement = true;
    this.erreur = '';
    this.rapportService.getClassementVendeurs(this.iso(debut), this.iso(fin)).subscribe({
      next: d => { this.donnees = d; this.chargement = false; event?.target?.complete(); },
      error: () => {
        this.erreur = 'Impossible de charger le classement. Réessayez.';
        this.chargement = false;
        event?.target?.complete();
      }
    });
  }

  part(v: LigneClassementVendeur): string {
    const total = this.donnees?.totalChiffreAffaires || 0;
    const p = total > 0 ? Math.round((v.chiffreAffaires / total) * 1000) / 10 : 0;
    return p.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  }

  prix(v: number | null | undefined): string {
    return Math.round(v || 0).toLocaleString('fr-FR') + ' F';
  }

  private iso(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${j}`;
  }
}
