import { Component } from '@angular/core';
import { JournalAuditService, JournalAuditEntry } from '../../services/journal-audit.service';
import { UserService, AppUser } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-journal-audit',
  templateUrl: './journal-audit.page.html',
  styleUrls: ['./journal-audit.page.scss'],
  standalone: false
})
export class JournalAuditPage {
  isAdmin = false;

  journaux: JournalAuditEntry[] = [];
  utilisateurs: AppUser[] = [];

  loading = false;
  errorMessage = '';

  // ── Filtres ──────────────────────────────────────────────
  dateDebut = '';
  dateFin = '';
  utilisateurId: number | null = null;

  // ── Pagination SERVEUR (page backend 0-based) ───────────
  pageActuelle = 0;
  taillePage = 20;
  totalPages = 1;
  totalElements = 0;

  constructor(
    private journalAuditService: JournalAuditService,
    private userService: UserService,
    private auth: AuthService
  ) {}

  ionViewWillEnter(): void {
    this.isAdmin = this.auth.isAdmin();
    if (!this.isAdmin) return;
    // Par défaut, on affiche les actions du jour même (pas tout l'historique).
    // Pour voir un autre jour ou un autre utilisateur, on change le filtre.
    const today = this.todayStr();
    this.dateDebut = today;
    this.dateFin = today;
    this.chargerUtilisateurs();
    this.charger();
  }

  private todayStr(): string {
    const now = new Date();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    const jour = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${mois}-${jour}`;
  }

  chargerUtilisateurs(): void {
    this.userService.getAllUsers().subscribe({
      next: users => { this.utilisateurs = users || []; },
      error: () => { /* filtre utilisateur restera vide, non bloquant */ }
    });
  }

  charger(): void {
    this.loading = true;
    this.errorMessage = '';
    this.journalAuditService.getJournal({
      page: this.pageActuelle,
      size: this.taillePage,
      dateDebut: this.dateDebut || undefined,
      dateFin: this.dateFin || undefined,
      utilisateurId: this.utilisateurId ?? undefined
    }).subscribe({
      next: res => {
        this.journaux = res?.journaux || [];
        this.totalPages = res?.totalPages ?? 1;
        this.totalElements = res?.totalElements ?? this.journaux.length;
        this.loading = false;
      },
      error: err => {
        this.errorMessage = err?.message || "Impossible de charger le journal d'audit";
        this.journaux = [];
        this.loading = false;
      }
    });
  }

  /** Applique les filtres et revient à la première page */
  appliquerFiltres(): void {
    this.pageActuelle = 0;
    this.charger();
  }

  /** Revient à la vue par défaut (jour même, tous les utilisateurs), pas à un historique complet non filtré. */
  effacerFiltres(): void {
    const today = this.todayStr();
    this.dateDebut = today;
    this.dateFin = today;
    this.utilisateurId = null;
    this.pageActuelle = 0;
    this.charger();
  }

  get aFiltresActifs(): boolean {
    const today = this.todayStr();
    return this.dateDebut !== today || this.dateFin !== today || !!this.utilisateurId;
  }

  allerPage(page: number): void {
    if (page < 0 || page >= this.totalPages || page === this.pageActuelle) return;
    this.pageActuelle = page;
    this.charger();
  }

  pagePrecedente(): void {
    this.allerPage(this.pageActuelle - 1);
  }

  pageSuivante(): void {
    this.allerPage(this.pageActuelle + 1);
  }

  libelleAction(action: string): string {
    return this.journalAuditService.libelleAction(action);
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  trackById = (_: number, item: JournalAuditEntry) => item.id;
}
