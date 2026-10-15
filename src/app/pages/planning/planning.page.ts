import { Component, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AlertController, ToastController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';

interface Case {
  date: string;
  repos: boolean;
  heureDebut: string | null;
  heureFin: string | null;
  note: string | null;
  rempli: boolean;
}

interface LigneEmploye {
  employeId: number;
  nom: string;
  poste: string;
  cases: Case[];
  minutesSemaine: number;
  joursTravail: number;
}

interface Jour {
  date: string;
  nom: string;
  aujourdhui: boolean;
}

interface Semaine {
  debut: string;
  fin: string;
  jours: Jour[];
  employes?: LigneEmploye[];
  relie?: boolean;
  moi?: LigneEmploye;
}

interface Edition {
  employe: LigneEmploye;
  index: number;
  repos: boolean;
  heureDebut: string;
  heureFin: string;
  note: string;
  autresJours: boolean[];
}

/** Planning de l'équipe : le gérant le remplit jour par jour, l'employé voit sa semaine. */
@Component({
  selector: 'app-planning',
  templateUrl: './planning.page.html',
  styleUrls: ['./planning.page.scss'],
  standalone: false
})
export class PlanningPage {
  private readonly api = `${environment.apiUrl}/planning`;
  readonly estGerant: boolean;
  debut = this.lundi(new Date());
  semaine: Semaine | null = null;
  jourChoisi = 0;
  chargement = false;
  erreur = '';
  edition: Edition | null = null;
  enregistrement = false;

  constructor(private http: HttpClient, private auth: AuthService,
              private alertCtrl: AlertController, private toastCtrl: ToastController) {
    this.estGerant = this.auth.isAdmin();
  }

  ionViewWillEnter(): void {
    this.charger();
  }

  @HostListener('document:keydown.escape')
  surEchap(): void {
    this.edition = null;
  }

  charger(event?: any): void {
    this.chargement = true;
    this.erreur = '';
    const url = this.estGerant ? this.api : `${this.api}/moi`;
    this.http.get<Semaine>(url, { params: { debut: this.debut } }).subscribe({
      next: s => {
        this.semaine = s;
        this.chargement = false;
        const auj = s.jours.findIndex(j => j.aujourdhui);
        if (auj >= 0 && this.jourChoisi === 0 && !this.dejaChoisi) this.jourChoisi = auj;
        event?.target?.complete();
      },
      error: e => {
        this.erreur = e?.error?.message || 'Impossible de charger le planning.';
        this.chargement = false;
        event?.target?.complete();
      }
    });
  }

  private dejaChoisi = false;

  choisirJour(i: number): void {
    this.jourChoisi = i;
    this.dejaChoisi = true;
  }

  changerSemaine(sens: number): void {
    const d = this.versDate(this.debut);
    d.setDate(d.getDate() + 7 * sens);
    this.debut = this.iso(d);
    this.dejaChoisi = true;
    this.charger();
  }

  get titreSemaine(): string {
    if (!this.semaine) return '';
    const f = (iso: string) => this.versDate(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `Du ${f(this.semaine.debut)} au ${f(this.semaine.fin)}`;
  }

  get estSemaineEnCours(): boolean {
    return this.debut === this.lundi(new Date());
  }

  // ------------------------------------------------------------------ affichage

  horaire(c: Case | undefined): string {
    if (!c || !c.rempli) return 'Pas prévu';
    if (c.repos) return 'Repos';
    return `${c.heureDebut} – ${c.heureFin}`;
  }

  duree(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  }

  jourCourt(j: Jour): string {
    return j.nom.slice(0, 3);
  }

  numeroJour(j: Jour): string {
    return String(this.versDate(j.date).getDate());
  }

  get nbTravaillent(): number {
    return (this.semaine?.employes || []).filter(e => {
      const c = e.cases[this.jourChoisi];
      return c?.rempli && !c.repos;
    }).length;
  }

  // ------------------------------------------------------------------ édition (gérant)

  ouvrir(e: LigneEmploye): void {
    const c = e.cases[this.jourChoisi];
    this.edition = {
      employe: e,
      index: this.jourChoisi,
      repos: !!c?.repos,
      heureDebut: c?.heureDebut || this.heureHabituelle(e, 'heureDebut') || '08:00',
      heureFin: c?.heureFin || this.heureHabituelle(e, 'heureFin') || '18:00',
      note: c?.note || '',
      autresJours: [false, false, false, false, false, false, false]
    };
  }

  /** Reprend l'horaire déjà mis un autre jour de la semaine pour aller plus vite. */
  private heureHabituelle(e: LigneEmploye, champ: 'heureDebut' | 'heureFin'): string | null {
    return e.cases.find(c => c.rempli && !c.repos && c[champ])?.[champ] || null;
  }

  basculerAutreJour(i: number): void {
    if (!this.edition || i === this.edition.index) return;
    this.edition.autresJours[i] = !this.edition.autresJours[i];
  }

  enregistrer(vider = false): void {
    if (!this.edition || !this.semaine) return;
    const ed = this.edition;
    if (!vider && !ed.repos && (!ed.heureDebut || !ed.heureFin || ed.heureFin <= ed.heureDebut)) {
      this.toast('L\'heure de fin doit être après l\'heure de début.', 'danger');
      return;
    }
    const indices = [ed.index, ...ed.autresJours.map((v, i) => (v ? i : -1)).filter(i => i >= 0 && i !== ed.index)];
    const cellules = indices.map(i => ({
      employeId: ed.employe.employeId,
      date: this.semaine!.jours[i].date,
      repos: vider ? false : ed.repos,
      heureDebut: vider || ed.repos ? null : ed.heureDebut,
      heureFin: vider || ed.repos ? null : ed.heureFin,
      note: vider ? null : ed.note
    }));
    this.enregistrement = true;
    this.http.put(this.api, { cellules }).subscribe({
      next: () => {
        this.enregistrement = false;
        this.edition = null;
        this.toast(vider ? 'Journée effacée' : 'Planning enregistré', 'success');
        this.charger();
      },
      error: e => { this.enregistrement = false; this.toast(e?.error?.message || 'Enregistrement impossible.', 'danger'); }
    });
  }

  async recopier(): Promise<void> {
    const precedent = this.versDate(this.debut);
    precedent.setDate(precedent.getDate() - 7);
    const alerte = await this.alertCtrl.create({
      header: 'Recopier la semaine d\'avant ?',
      message: 'Les horaires de la semaine précédente sont recopiés sur cette semaine. Les jours déjà remplis ne changent pas.',
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        {
          text: 'Recopier', cssClass: 'alert-btn-primary',
          handler: () => this.http.post<{ copiees: number; gardees: number }>(`${this.api}/copier`,
            { depuis: this.iso(precedent), vers: this.debut, ecraser: false }).subscribe({
            next: r => { this.toast(`${r.copiees} journée(s) recopiée(s)`, 'success'); this.charger(); },
            error: e => this.toast(e?.error?.message || 'Copie impossible.', 'danger')
          })
        }
      ]
    });
    await alerte.present();
  }

  // ------------------------------------------------------------------ outils

  private lundi(d: Date): string {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return this.iso(x);
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private versDate(iso: string): Date {
    const [a, m, j] = iso.split('-').map(Number);
    return new Date(a, m - 1, j);
  }

  private async toast(message: string, color: 'success' | 'danger'): Promise<void> {
    const t = await this.toastCtrl.create({ message, color, duration: 2200, position: 'top' });
    await t.present();
  }
}
