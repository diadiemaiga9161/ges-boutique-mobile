import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { BarcodeService } from '../../services/barcode.service';

interface LignePointage {
  employeId: number;
  nom: string;
  poste: string;
  pointageId: number | null;
  date: string | null;
  heureArrivee: string | null;
  heureDepart: string | null;
  methodeArrivee: string | null;
  retardMinutes: number;
  minutesTravail: number | null;
  statut: 'PAS_ENCORE' | 'ABSENT' | 'PRESENT' | 'PARTI' | 'REPOS';
  aCompte?: boolean;
  horaire?: string | null;
}

interface MesPointages {
  relie: boolean;
  employe?: string;
  aujourdhui?: LignePointage;
  jours?: LignePointage[];
  resume?: { joursPresence: number; absences: number; retards: number; minutesTravail: number };
}

/**
 * Mon pointage : l'employé scanne le code QR affiché dans la boutique (arrivée, puis départ).
 * Le gérant voit aussi qui est là aujourd'hui et peut pointer à la main ceux sans compte.
 */
@Component({
  selector: 'app-pointage',
  templateUrl: './pointage.page.html',
  styleUrls: ['./pointage.page.scss'],
  standalone: false
})
export class PointagePage {
  private readonly api = `${environment.apiUrl}/pointage`;

  chargement = false;
  envoi = false;
  erreur = '';
  resultat: { ok: boolean; texte: string } | null = null;
  moi: MesPointages | null = null;
  equipe: LignePointage[] = [];
  readonly estGerant: boolean;

  constructor(private http: HttpClient, private barcode: BarcodeService, private auth: AuthService,
              private route: ActivatedRoute, private router: Router) {
    this.estGerant = this.auth.isAdmin();
  }

  ionViewWillEnter(): void {
    this.charger();
    // Code QR scanné avec l'appareil photo du téléphone : l'adresse contient le code.
    const code = this.route.snapshot.queryParamMap.get('c');
    if (code) {
      this.router.navigate([], { queryParams: {}, replaceUrl: true });
      this.envoyer(code);
    }
  }

  charger(event?: any): void {
    this.chargement = true;
    this.erreur = '';
    this.http.get<MesPointages>(`${this.api}/moi`).subscribe({
      next: m => { this.moi = m; this.chargement = false; event?.target?.complete(); },
      error: e => {
        this.erreur = e?.error?.message || 'Impossible de charger le pointage. Réessayez.';
        this.chargement = false;
        event?.target?.complete();
      }
    });
    if (this.estGerant) {
      this.http.get<{ employes: LignePointage[] }>(`${this.api}/jour`).subscribe({
        next: j => (this.equipe = j.employes),
        error: () => (this.equipe = [])
      });
    }
  }

  async scanner(): Promise<void> {
    this.resultat = null;
    const code = await this.barcode.scan();
    if (code) this.envoyer(code);
  }

  private envoyer(code: string): void {
    this.envoi = true;
    this.resultat = null;
    this.http.post<{ action: string; message: string }>(`${this.api}/scanner`, { code }).subscribe({
      next: r => {
        this.resultat = { ok: true, texte: r.message };
        this.envoi = false;
        this.charger();
      },
      error: e => {
        this.resultat = { ok: false, texte: e?.error?.message || 'Pointage impossible. Réessayez.' };
        this.envoi = false;
      }
    });
  }

  /** Gérant : pointe à la main l'arrivée ou le départ d'un employé, à l'heure actuelle. */
  pointerMaintenant(l: LignePointage): void {
    const maintenant = new Date().toTimeString().slice(0, 5);
    const corps = l.heureArrivee
      ? { employeId: l.employeId, heureArrivee: l.heureArrivee, heureDepart: maintenant }
      : { employeId: l.employeId, heureArrivee: maintenant };
    this.http.post(`${this.api}/manuel`, corps).subscribe({
      next: () => {
        this.resultat = { ok: true, texte: `${l.nom} : ${l.heureArrivee ? 'départ' : 'arrivée'} pointé(e) à ${maintenant}.` };
        this.charger();
      },
      error: e => (this.resultat = { ok: false, texte: e?.error?.message || 'Pointage impossible.' })
    });
  }

  libelleStatut(l: LignePointage): string {
    if (l.statut === 'PAS_ENCORE') return 'Pas encore arrivé';
    if (l.statut === 'ABSENT') return 'Absent';
    if (l.statut === 'PARTI') return 'Parti';
    if (l.statut === 'REPOS') return 'Repos';
    return l.retardMinutes > 0 ? 'En retard' : 'Présent';
  }

  duree(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h} h ${m.toString().padStart(2, '0')}` : `${m} min`;
  }

  jourLisible(iso: string | null): string {
    if (!iso) return '';
    const [a, m, j] = iso.split('-').map(Number);
    return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
}
