import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BoutiqueService } from '../../services/boutique.service';

interface ClientAbsent {
  clientId: number;
  nom: string;
  telephone: string | null;
  nbAchats: number;
  montantTotal: number;
  panierMoyen: number;
  derniereVisite: string;
  joursAbsence: number;
  intervalleHabituel: number;
  produits: string[];
}

interface Reponse {
  jours: number;
  minAchats: number;
  periodeJours: number;
  total: number;
  montantEnJeu: number;
  clients: ClientAbsent[];
}

/** Bons clients qui ne viennent plus : à rappeler avant de les perdre (gérant). */
@Component({
  selector: 'app-clients-absents',
  templateUrl: './clients-absents.page.html',
  styleUrls: ['./clients-absents.page.scss'],
  standalone: false
})
export class ClientsAbsentsPage {
  readonly choix = [
    { jours: 14, libelle: '2 semaines' },
    { jours: 21, libelle: '3 semaines' },
    { jours: 30, libelle: '1 mois' }
  ];
  jours = 14;
  donnees: Reponse | null = null;
  chargement = false;
  erreur = '';

  constructor(private http: HttpClient, private boutiqueService: BoutiqueService) {}

  ionViewWillEnter(): void {
    this.charger();
  }

  choisir(jours: number): void {
    if (this.jours === jours) return;
    this.jours = jours;
    this.charger();
  }

  charger(event?: any): void {
    this.chargement = true;
    this.erreur = '';
    this.http.get<Reponse>(`${environment.apiUrl}/rapports/clients-absents`, { params: { jours: this.jours } }).subscribe({
      next: r => { this.donnees = r; this.chargement = false; event?.target?.complete(); },
      error: e => {
        this.erreur = e?.error?.message || 'Impossible de charger la liste. Réessayez.';
        this.chargement = false;
        event?.target?.complete();
      }
    });
  }

  libelleChoix(): string {
    return this.choix.find(c => c.jours === this.jours)?.libelle || `${this.jours} jours`;
  }

  initiales(nom: string): string {
    return nom.split(/\s+/).filter(Boolean).slice(0, 2).map(m => m[0].toUpperCase()).join('') || '?';
  }

  /** Plus l'absence dépasse l'habitude du client, plus c'est urgent. */
  urgence(c: ClientAbsent): 'forte' | 'moyenne' {
    return c.joursAbsence >= 30 || (c.intervalleHabituel > 0 && c.joursAbsence >= c.intervalleHabituel * 5) ? 'forte' : 'moyenne';
  }

  habitude(c: ClientAbsent): string {
    if (c.intervalleHabituel <= 1) return 'Venait presque tous les jours';
    if (c.intervalleHabituel < 7) return `Venait tous les ${c.intervalleHabituel} jours`;
    const semaines = Math.round(c.intervalleHabituel / 7);
    return semaines <= 1 ? 'Venait chaque semaine' : `Venait toutes les ${semaines} semaines`;
  }

  derniereVisite(c: ClientAbsent): string {
    const [a, m, j] = c.derniereVisite.split('-').map(Number);
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  }

  numero(c: ClientAbsent): string {
    return (c.telephone || '').replace(/\D/g, '');
  }

  appeler(c: ClientAbsent): void {
    const n = this.numero(c);
    if (n) window.location.href = `tel:${n}`;
  }

  whatsapp(c: ClientAbsent): void {
    const n = this.numero(c);
    if (!n) return;
    const boutique = this.boutiqueService.getInfo()?.nom || 'votre boutique';
    const prenom = c.nom.split(/\s+/)[0];
    const message = `Bonjour ${prenom}, ça fait longtemps qu'on ne vous a pas vu chez ${boutique} ! `
      + `Tout va bien ? Vos produits habituels vous attendent. À bientôt !`;
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`, '_blank');
  }

  prix(v: number): string {
    return Math.round(v || 0).toLocaleString('fr-FR') + ' F';
  }
}
