import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

/**
 * Liste FERMÉE des types d'action d'audit (enum backend `TypeActionAudit`).
 * Si le backend renvoie un code non reconnu, on affiche le code brut en repli.
 */
export type TypeActionAudit =
  | 'SUPPRESSION_VENTE'
  | 'MODIFICATION_PRIX_PRODUIT'
  | 'ANNULATION_TRANSFERT'
  | 'SUPPRESSION_TRANSFERT'
  | 'SUPPRESSION_CLIENT'
  | 'SUPPRESSION_FOURNISSEUR'
  | 'MODIFICATION_ROLE_UTILISATEUR'
  | 'SUPPRESSION_CREDIT';

export interface JournalAuditEntry {
  id: number;
  utilisateurId: number;
  utilisateurNom: string;
  action: TypeActionAudit | string;
  details: string;
  dateAction: string;
}

export interface JournalAuditFiltre {
  page?: number;
  size?: number;
  dateDebut?: string;
  dateFin?: string;
  utilisateurId?: number;
}

export interface JournalAuditResponse {
  success: boolean;
  journaux: JournalAuditEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Libellés FR figés pour les 8 actions d'audit — identiques sur les 3 plateformes
 * (Angular web, React Native, Ionic). Volontairement non traduits via i18n :
 * ce sont des libellés techniques/réglementaires qui doivent rester identiques
 * quelle que soit la langue choisie par l'utilisateur de l'app.
 */
const LIBELLES_ACTION_AUDIT: Record<string, string> = {
  SUPPRESSION_VENTE: "Suppression d'une vente",
  MODIFICATION_PRIX_PRODUIT: "Modification du prix d'un produit",
  ANNULATION_TRANSFERT: "Annulation d'un transfert",
  SUPPRESSION_TRANSFERT: "Suppression d'un transfert",
  SUPPRESSION_CLIENT: "Suppression d'un client",
  SUPPRESSION_FOURNISSEUR: "Suppression d'un fournisseur",
  MODIFICATION_ROLE_UTILISATEUR: "Modification du rôle d'un utilisateur",
  SUPPRESSION_CREDIT: "Suppression d'un crédit/dette"
};

@Injectable({ providedIn: 'root' })
export class JournalAuditService {
  private readonly apiUrl = `${environment.apiUrl}/journal-audit`;

  constructor(private http: HttpClient) {}

  getJournal(filtre: JournalAuditFiltre = {}): Observable<JournalAuditResponse> {
    let params = new HttpParams();
    if (filtre.page !== undefined && filtre.page !== null) params = params.set('page', filtre.page);
    if (filtre.size !== undefined && filtre.size !== null) params = params.set('size', filtre.size);
    if (filtre.dateDebut) params = params.set('dateDebut', filtre.dateDebut);
    if (filtre.dateFin) params = params.set('dateFin', filtre.dateFin);
    if (filtre.utilisateurId) params = params.set('utilisateurId', filtre.utilisateurId);

    return this.http.get<JournalAuditResponse>(this.apiUrl, { params }).pipe(
      catchError(error => this.handleError(error, "récupérer le journal d'audit"))
    );
  }

  /** Libellé FR lisible pour un code d'action ; renvoie le code brut si inconnu. */
  libelleAction(action: string): string {
    return LIBELLES_ACTION_AUDIT[action] || action;
  }

  private handleError(error: any, context: string): Observable<never> {
    return throwError(() => new Error(error.error?.message || error.error?.error || `Impossible de ${context}`));
  }
}
