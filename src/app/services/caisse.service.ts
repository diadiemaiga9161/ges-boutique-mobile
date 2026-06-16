import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export enum ModePaiementCaisse {
  ESPECES = 'ESPECES',
  ORANGE_MONEY = 'ORANGE_MONEY',
  MOOV_MONEY = 'MOOV_MONEY',
  CARTE_BANCAIRE = 'CARTE_BANCAIRE',
  VIREMENT = 'VIREMENT',
  CHEQUE = 'CHEQUE'
}

export enum TypeOperationCaisse {
  VENTE_COMPTANT = 'VENTE_COMPTANT',
  VENTE_CREDIT = 'VENTE_CREDIT',
  REGLEMENT_CREDIT = 'REGLEMENT_CREDIT',
  ENTREE = 'ENTREE',
  SORTIE = 'SORTIE',
  OUVERTURE = 'OUVERTURE',
  FERMETURE = 'FERMETURE',
  AJUSTEMENT = 'AJUSTEMENT',
  PAIEMENT_FOURNISSEUR = 'PAIEMENT_FOURNISSEUR',
  AVANCE_FOURNISSEUR = 'AVANCE_FOURNISSEUR',
  PAIEMENT_EMPLOYE = 'PAIEMENT_EMPLOYE'
}

export interface TransfertCaisseBanqueRequest {
  compteId: number;
  montant: number;
  motif: string;
  utilisateurId?: number;
  reference?: string;
}

export interface Caisse {
  id: number;
  numeroCaisse: string;
  soldeActuel: number;
  soldeInitial: number;
  soldeSysteme: number;
  soldeReel: number;
  ecart: number;
  totalEntrees: number;
  totalSorties: number;
  estOuverte: boolean;
  verifiee?: boolean;
  dateOuverture?: string;
  dateFermeture?: string;
  nombreOperations?: number;
}

export interface OperationCaisse {
  id: number;
  type: string;
  montant: number;
  soldeAvant?: number;
  soldeApres?: number;
  motif: string;
  utilisateurNom?: string;
  modePaiement?: string;
  referencePaiement?: string;
  clientNom?: string;
  clientTelephone?: string;
  dateOperation: string;
  numeroVente?: string;
  venteAnnulee?: boolean;
}

export interface CaisseRequest {
  montant: number;
  motif: string;
  utilisateurId?: number;
  modePaiement?: string;
  referencePaiement?: string;
}

export interface CreditInfo {
  id: number;
  venteId: number;
  numeroVente: string;
  clientNom: string;
  clientTelephone?: string;
  montantTotal: number;
  montantVerse: number;
  montantRestant: number;
  dateEcheance?: string;
  estReglee?: boolean;
  enRetard?: boolean;
  joursRetard?: number;
  venteAnnulee?: boolean;
  progression?: number;
}

export interface SituationCredits {
  nombreCreditsNonRegles: number;
  montantTotalCredits: number;
  montantRestantTotal: number;
  nombreCreditsEnRetard: number;
  montantTotalRetard: number;
}

export interface ReglementCreditRequest {
  venteCreditId: number;
  montantRegle: number;
  utilisateurId?: number;
  modePaiement: string;
  referencePaiement?: string;
}

export interface StatistiquesCaisse {
  totalVentesComptant: number;
  totalNouveauxCredits: number;
  totalReglementsCredit: number;
  totalAutresEntrees: number;
  totalSorties: number;
  totalEntrees: number;
  soldeNetPeriode: number;
  nombreOperations: number;
}

@Injectable({
  providedIn: 'root'
})
export class CaisseService {
  private readonly apiUrl = `${environment.apiUrl}/caisse`;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  ouvrirCaisse(): Observable<Caisse> {
    return this.http.post<any>(`${this.apiUrl}/ouvrir`, {}).pipe(
      map(response => response?.caisse || response?.data || response),
      catchError(error => this.handleError(error, 'ouvrir la caisse'))
    );
  }

  fermerCaisse(utilisateurId?: number): Observable<Caisse> {
    const params = utilisateurId ? new HttpParams().set('utilisateurId', utilisateurId) : undefined;
    return this.http.post<any>(`${this.apiUrl}/fermer`, {}, { params }).pipe(
      map(response => response?.caisse || response?.data || response),
      catchError(error => this.handleError(error, 'fermer la caisse'))
    );
  }

  getEtatCaisse(): Observable<Caisse> {
    return this.http.get<any>(`${this.apiUrl}/etat`).pipe(
      map(response => response?.caisse || response?.data || response),
      catchError(error => this.handleError(error, 'récupérer l’état de la caisse'))
    );
  }

  getSolde(): Observable<{ solde: number; soldeSysteme: number }> {
    return this.http.get<any>(`${this.apiUrl}/solde`).pipe(
      map(response => ({
        solde: Number(response?.solde || 0),
        soldeSysteme: Number(response?.soldeSysteme || response?.solde || 0)
      })),
      catchError(error => this.handleError(error, 'récupérer le solde'))
    );
  }

  entreeCaisse(request: CaisseRequest): Observable<OperationCaisse> {
    return this.http.post<any>(`${this.apiUrl}/entree`, this.withUser(request)).pipe(
      map(response => response?.operation || response?.data || response),
      catchError(error => this.handleError(error, 'enregistrer l’entrée'))
    );
  }

  sortieCaisse(request: CaisseRequest): Observable<OperationCaisse> {
    return this.http.post<any>(`${this.apiUrl}/sortie`, this.withUser(request)).pipe(
      map(response => response?.operation || response?.data || response),
      catchError(error => this.handleError(error, 'enregistrer la sortie'))
    );
  }

  getOperationsDuJour(): Observable<OperationCaisse[]> {
    return this.http.get<any>(`${this.apiUrl}/operations/aujourdhui`).pipe(
      map(response => this.extractList<OperationCaisse>(response, 'operations')),
      catchError(error => this.handleError(error, 'récupérer les opérations du jour'))
    );
  }

  getOperationsParPeriode(dateDebut: string, dateFin: string): Observable<OperationCaisse[]> {
    const params = new HttpParams().set('dateDebut', dateDebut).set('dateFin', dateFin);
    return this.http.get<any>(`${this.apiUrl}/operations/periode`, { params }).pipe(
      map(response => this.extractList<OperationCaisse>(response, 'operations')),
      catchError(error => this.handleError(error, 'récupérer les opérations'))
    );
  }

  getCreditsNonRegles(): Observable<CreditInfo[]> {
    return this.http.get<any>(`${this.apiUrl}/credits`).pipe(
      map(response => {
        const raw = this.extractList<any>(response, 'credits');
        return raw.filter((c: any) => !c.venteAnnulee && !c.annulee)
                  .map((c: any) => this.enrichirCredit(c));
      }),
      catchError(error => this.handleError(error, 'récupérer les crédits'))
    );
  }

  getCreditsEnRetard(): Observable<CreditInfo[]> {
    return this.http.get<any>(`${this.apiUrl}/credits/retard`).pipe(
      map(response => {
        const raw = this.extractList<any>(response, 'creditsEnRetard');
        return raw.filter((c: any) => !c.venteAnnulee && !c.annulee)
                  .map((c: any) => this.enrichirCredit(c));
      }),
      catchError(error => this.handleError(error, 'récupérer les crédits en retard'))
    );
  }

  private enrichirCredit(c: any): CreditInfo {
    const maintenant = new Date();
    const echeance = c.dateEcheance ? new Date(c.dateEcheance) : null;
    const enRetard = echeance ? echeance < maintenant : false;
    const joursRetard = enRetard && echeance
      ? Math.ceil(Math.abs(maintenant.getTime() - echeance.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const montantTotal = Number(c.montantTotal || c.montant || 0);
    const montantVerse = Number(c.montantVerse || 0);
    const montantRestant = Number(c.montantRestant ?? (montantTotal - montantVerse));
    const venteId = Number(c.venteId || c.vente?.id || c.id || 0);

    return {
      id: c.id,
      venteId,
      numeroVente: c.numeroVente || c.numero || '',
      clientNom: c.clientNom || c.client?.nom || 'Client',
      clientTelephone: c.clientTelephone || c.client?.telephone || '',
      montantTotal,
      montantVerse,
      montantRestant,
      dateEcheance: c.dateEcheance || '',
      estReglee: !!c.creditRegle || !!c.estReglee || montantRestant <= 0,
      enRetard,
      joursRetard,
      progression: montantTotal > 0 ? (montantVerse / montantTotal) * 100 : 0,
      venteAnnulee: !!c.venteAnnulee || !!c.annulee
    };
  }

  getSituationCredits(): Observable<SituationCredits> {
    return this.http.get<any>(`${this.apiUrl}/credits/situation`).pipe(
      map(response => response?.situation || response?.data || response),
      catchError(error => this.handleError(error, 'récupérer la situation des crédits'))
    );
  }

  reglementCredit(request: ReglementCreditRequest): Observable<OperationCaisse> {
    return this.http.post<any>(`${this.apiUrl}/credits/reglement`, this.withUser(request)).pipe(
      map(response => response?.reglement || response?.operation || response?.data || response),
      catchError(error => this.handleError(error, 'enregistrer le règlement'))
    );
  }

  getStatistiquesDuJour(): Observable<StatistiquesCaisse> {
    return this.http.get<any>(`${this.apiUrl}/statistiques/aujourdhui`).pipe(
      map(response => response?.statistiques || response?.data || response),
      catchError(error => this.handleError(error, 'récupérer les statistiques'))
    );
  }

  getRevenusEtPertesParPeriode(dateDebut: string, dateFin: string): Observable<any> {
    const params = new HttpParams().set('dateDebut', dateDebut).set('dateFin', dateFin);
    return this.http.get<any>(`${this.apiUrl}/revenus-pertes`, { params }).pipe(
      map(response => response?.resultats || response?.data || response),
      catchError(error => this.handleError(error, 'récupérer les revenus et pertes'))
    );
  }

  transfererVersBanque(request: TransfertCaisseBanqueRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/transfert-banque`, this.withUser(request)).pipe(
      map(response => response?.data || response),
      catchError(error => this.handleError(error, 'transférer vers la banque'))
    );
  }

  getHistoriqueReglementsCredit(venteId: number): Observable<OperationCaisse[]> {
    return this.http.get<any>(`${this.apiUrl}/credits/${venteId}/reglements`).pipe(
      map(response => this.extractList<OperationCaisse>(response, 'reglements')),
      catchError(error => this.handleError(error, 'récupérer l\'historique des règlements'))
    );
  }

  getOperationsDeLaSemaine(): Observable<OperationCaisse[]> {
    const params = new HttpParams().set('dateDebut', this.getDateDebutSemaine()).set('dateFin', this.getDateFinSemaine());
    return this.http.get<any>(`${this.apiUrl}/operations/periode`, { params }).pipe(
      map(response => this.extractList<OperationCaisse>(response, 'operations')),
      catchError(error => this.handleError(error, 'récupérer les opérations de la semaine'))
    );
  }

  getOperationsDuMois(): Observable<OperationCaisse[]> {
    const params = new HttpParams().set('dateDebut', this.getDateDebutMois()).set('dateFin', this.getDateFinMois());
    return this.http.get<any>(`${this.apiUrl}/operations/periode`, { params }).pipe(
      map(response => this.extractList<OperationCaisse>(response, 'operations')),
      catchError(error => this.handleError(error, 'récupérer les opérations du mois'))
    );
  }

  getOperationsDeLAnnee(): Observable<OperationCaisse[]> {
    const params = new HttpParams().set('dateDebut', this.getDateDebutAnnee()).set('dateFin', this.getDateFinAnnee());
    return this.http.get<any>(`${this.apiUrl}/operations/periode`, { params }).pipe(
      map(response => this.extractList<OperationCaisse>(response, 'operations')),
      catchError(error => this.handleError(error, 'récupérer les opérations de l\'année'))
    );
  }

  getStatistiquesParPeriode(dateDebut: string, dateFin: string): Observable<StatistiquesCaisse> {
    const params = new HttpParams().set('dateDebut', dateDebut).set('dateFin', dateFin);
    return this.http.get<any>(`${this.apiUrl}/statistiques/periode`, { params }).pipe(
      map(response => response?.statistiques || response?.data || response),
      catchError(error => this.handleError(error, 'récupérer les statistiques de la période'))
    );
  }

  telechargerRapportJournalier(): Observable<void> {
    return this.http.get(`${this.apiUrl}/rapport/journalier`, { responseType: 'blob' }).pipe(
      map((blob: Blob) => this.downloadBlob(blob, `rapport-journalier-${this.getAujourdhui()}.pdf`)),
      catchError(error => this.handleError(error, 'télécharger le rapport journalier'))
    );
  }

  telechargerRapportHebdomadaire(): Observable<void> {
    return this.http.get(`${this.apiUrl}/rapport/hebdomadaire`, { responseType: 'blob' }).pipe(
      map((blob: Blob) => this.downloadBlob(blob, `rapport-hebdomadaire.pdf`)),
      catchError(error => this.handleError(error, 'télécharger le rapport hebdomadaire'))
    );
  }

  telechargerRapportMensuel(): Observable<void> {
    return this.http.get(`${this.apiUrl}/rapport/mensuel`, { responseType: 'blob' }).pipe(
      map((blob: Blob) => this.downloadBlob(blob, `rapport-mensuel.pdf`)),
      catchError(error => this.handleError(error, 'télécharger le rapport mensuel'))
    );
  }

  telechargerRapportAnnuel(): Observable<void> {
    return this.http.get(`${this.apiUrl}/rapport/annuel`, { responseType: 'blob' }).pipe(
      map((blob: Blob) => this.downloadBlob(blob, `rapport-annuel.pdf`)),
      catchError(error => this.handleError(error, 'télécharger le rapport annuel'))
    );
  }

  telechargerRapportPersonnalise(dateDebut: string, dateFin: string): Observable<void> {
    const params = new HttpParams().set('dateDebut', dateDebut).set('dateFin', dateFin);
    return this.http.get(`${this.apiUrl}/rapport/periode`, { params, responseType: 'blob' }).pipe(
      map((blob: Blob) => this.downloadBlob(blob, `rapport-${dateDebut}-${dateFin}.pdf`)),
      catchError(error => this.handleError(error, 'télécharger le rapport personnalisé'))
    );
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  }

  formatDate(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getTypeOperationLabel(type: string): string {
    const labels: Record<string, string> = {
      OUVERTURE: 'Ouverture',
      FERMETURE: 'Fermeture',
      VENTE_COMPTANT: 'Vente comptant',
      VENTE_CREDIT: 'Vente crédit',
      REGLEMENT_CREDIT: 'Règlement crédit',
      SORTIE: 'Sortie',
      ENTREE: 'Entrée',
      AJUSTEMENT: 'Ajustement'
    };
    return labels[type] || type;
  }

  getModePaiementLabel(mode: string): string {
    const labels: Record<string, string> = {
      ESPECES: 'Espèces',
      ORANGE_MONEY: 'Orange Money',
      MOOV_MONEY: 'Moov Money',
      CARTE_BANCAIRE: 'Carte',
      VIREMENT: 'Virement',
      CHEQUE: 'Chèque'
    };
    return labels[mode] || mode;
  }

  getModePaiementClass(mode: string): string {
    const classes: Record<string, string> = {
      ESPECES: 'badge-success',
      ORANGE_MONEY: 'badge-warning',
      MOOV_MONEY: 'badge-info',
      CARTE_BANCAIRE: 'badge-primary',
      VIREMENT: 'badge-secondary'
    };
    return classes[mode] || 'badge-secondary';
  }

  getTypeOperationClass(type: string): string {
    const classes: Record<string, string> = {
      VENTE_COMPTANT: 'text-success',
      VENTE_CREDIT: 'text-info',
      REGLEMENT_CREDIT: 'text-primary',
      ENTREE: 'text-success',
      SORTIE: 'text-danger',
      OUVERTURE: 'text-primary',
      FERMETURE: 'text-secondary',
      PAIEMENT_FOURNISSEUR: 'text-warning',
      PAIEMENT_EMPLOYE: 'text-warning'
    };
    return classes[type] || 'text-muted';
  }

  getCreditStatusText(credit: CreditInfo): string {
    if (credit.estReglee) return 'Réglé';
    if (credit.enRetard) return `En retard (${credit.joursRetard || 0}j)`;
    return 'En cours';
  }

  getCreditStatusClass(credit: CreditInfo): string {
    if (credit.estReglee) return 'success';
    if (credit.enRetard) return 'danger';
    return 'warning';
  }

  getEcartClass(ecart: number): string {
    if (ecart === 0) return 'text-success';
    if (ecart > 0) return 'text-info';
    return 'text-danger';
  }

  getEcartSign(ecart: number): string {
    return ecart >= 0 ? '+' : '';
  }

  formatDateLong(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  formatDateShort(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatTime(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  getAujourdhui(): string {
    return new Date().toISOString().split('T')[0];
  }

  getDateDebutSemaine(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }

  getDateFinSemaine(): string {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }

  getDateDebutMois(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }

  getDateFinMois(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  getDateDebutAnnee(): string {
    return new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  }

  getDateFinAnnee(): string {
    return new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0];
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private withUser<T extends { utilisateurId?: number }>(request: T): T {
    return { ...request, utilisateurId: request.utilisateurId || this.auth.getUserId() };
  }

  private extractList<T>(response: any, key: string): T[] {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.[key])) return response[key];
    if (Array.isArray(response?.data)) return response.data;
    return [];
  }

  private handleError(error: any, context: string): Observable<never> {
    let message = `Impossible de ${context}`;
    if (error.status === 0) message = 'Impossible de se connecter au serveur';
    if (error.error?.message) message = error.error.message;
    if (typeof error.error === 'string') message = error.error;
    return throwError(() => new Error(message));
  }
}
