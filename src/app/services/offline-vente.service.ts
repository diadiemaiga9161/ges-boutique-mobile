import { Injectable } from '@angular/core';
import { VenteService, VenteRequest, VenteCreditRequest, VenteMap } from './vente.service';
import { OfflineSyncService } from './offline-sync.service';
import { NetworkStatusService } from './network-status.service';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class OfflineVenteService {
  constructor(
    private venteService: VenteService,
    private offlineSyncService: OfflineSyncService,
    private networkService: NetworkStatusService
  ) {}

  createVente(vente: VenteRequest): Observable<VenteMap> {
    if (this.networkService.isOnline()) {
      const clientRequestId = this.offlineSyncService.generateClientRequestId();
      return this.venteService.createVente(vente).pipe(
        tap(() => {
          console.log('Vente créée en ligne avec clientRequestId:', clientRequestId);
        }),
        catchError(error => {
          if (error.status === 0) {
            return this.handleOfflineVente(vente, '/ventes', clientRequestId);
          }
          return throwError(() => error);
        })
      );
    } else {
      const clientRequestId = this.offlineSyncService.generateClientRequestId();
      return this.handleOfflineVente(vente, '/ventes', clientRequestId);
    }
  }

  createVenteCredit(vente: VenteCreditRequest): Observable<VenteMap> {
    if (this.networkService.isOnline()) {
      const clientRequestId = this.offlineSyncService.generateClientRequestId();
      return this.venteService.createVenteCredit(vente).pipe(
        tap(() => {
          console.log('Vente crédit créée en ligne avec clientRequestId:', clientRequestId);
        }),
        catchError(error => {
          if (error.status === 0) {
            return this.handleOfflineVente(vente, '/ventes/credit', clientRequestId);
          }
          return throwError(() => error);
        })
      );
    } else {
      const clientRequestId = this.offlineSyncService.generateClientRequestId();
      return this.handleOfflineVente(vente, '/ventes/credit', clientRequestId);
    }
  }

  private handleOfflineVente(
    vente: VenteRequest | VenteCreditRequest,
    endpoint: string,
    clientRequestId: string
  ): Observable<VenteMap> {
    return new Observable(observer => {
      this.offlineSyncService.addOfflineAction(
        endpoint.includes('credit') ? 'VENTE_CREDIT' : 'VENTE',
        endpoint,
        'POST',
        vente
      ).then(action => {
        const offlineResponse: VenteMap = {
          id: -1,
          numeroVente: `OFFLINE-${action.id}`,
          vendeurId: vente.vendeurId,
          vendeurNom: '',
          montantTotal: this.calculateTotal(vente.lignes),
          montantRemiseTotal: vente.remiseGlobale || 0,
          montantApresRemise: this.calculateTotal(vente.lignes) - (vente.remiseGlobale || 0),
          modePaiement: typeof vente.modePaiement === 'string' ? vente.modePaiement : '',
          referencePaiement: vente.referencePaiement || '',
          dateVente: new Date().toISOString(),
          nombreProduits: vente.lignes.length,
          lignes: [],
          produits: [],
          estCredit: vente.estCredit || false,
          clientId: vente.clientId,
          clientNom: vente.clientNom || '',
          clientPrenom: vente.clientPrenom || '',
          clientTelephone: vente.clientTelephone || '',
          dateEcheance: vente.dateEcheance || '',
          montantVerse: vente.montantVerse || 0,
          montantRestant: 0,
          creditRegle: false,
          annulee: false
        };

        observer.next(offlineResponse);
        observer.complete();
      }).catch(error => {
        observer.error(new Error(`Erreur lors de la sauvegarde offline: ${error.message}`));
      });
    });
  }

  private calculateTotal(lignes: any[]): number {
    return lignes.reduce((sum, ligne) => {
      const prix = (ligne.prixUnitaire || 0) * (ligne.quantite || 0);
      const remise = (ligne.remisePourcentage || 0) > 0
        ? prix * (ligne.remisePourcentage / 100)
        : (ligne.remiseMontant || 0);
      return sum + (prix - remise);
    }, 0);
  }

  getVenteById(id: number): Observable<VenteMap> {
    return this.venteService.getVenteById(id);
  }

  getAllVentes(): Observable<VenteMap[]> {
    return this.venteService.getAllVentes();
  }

  getVentesParType() {
    return this.venteService.getVentesParType();
  }

  getVentesComptant(): Observable<VenteMap[]> {
    return this.venteService.getVentesComptant();
  }

  getVentesCredit(): Observable<VenteMap[]> {
    return this.venteService.getVentesCredit();
  }

  getVentesParPeriode(dateDebut: string, dateFin: string): Observable<VenteMap[]> {
    return this.venteService.getVentesParPeriode(dateDebut, dateFin);
  }

  modifierVente(venteId: number, vente: VenteRequest): Observable<VenteMap> {
    return this.venteService.modifierVente(venteId, vente);
  }

  modifierVenteCredit(venteId: number, vente: VenteCreditRequest): Observable<VenteMap> {
    return this.venteService.modifierVenteCredit(venteId, vente);
  }

  annulerVente(venteId: number, motif?: string): Observable<VenteMap> {
    return this.venteService.annulerVente(venteId, motif);
  }

  annulerVenteCredit(venteId: number, motif?: string): Observable<VenteMap> {
    return this.venteService.annulerVenteCredit(venteId, motif);
  }

  supprimerVente(venteId: number): Observable<void> {
    return this.venteService.supprimerVente(venteId);
  }

  supprimerVenteCredit(venteId: number): Observable<void> {
    return this.venteService.supprimerVenteCredit(venteId);
  }

  telechargerFacture(venteId: number): Observable<void> {
    return this.venteService.telechargerFacture(venteId);
  }

  exportVentesToPDF(ventes: VenteMap[], titre?: string): void {
    return this.venteService.exportVentesToPDF(ventes, titre);
  }

  exportVentesClientDetailToPDF(ventes: VenteMap[], clientNom: string, clientPrenom?: string): void {
    return this.venteService.exportVentesClientDetailToPDF(ventes, clientNom, clientPrenom);
  }

  exportVentesCreditDetailToPDF(credits: VenteMap[]): void {
    return this.venteService.exportVentesCreditDetailToPDF(credits);
  }

  exportVentesClientDiversDetailToPDF(ventes: VenteMap[]): void {
    return this.venteService.exportVentesClientDiversDetailToPDF(ventes);
  }

  exportCreditsRetardDetailToPDF(credits: VenteMap[]): void {
    return this.venteService.exportCreditsRetardDetailToPDF(credits);
  }

  getStatistiquesChiffreAffaire() {
    return this.venteService.getStatistiquesChiffreAffaire();
  }

  getStatistiquesCredits() {
    return this.venteService.getStatistiquesCredits();
  }

  getClients() {
    return this.venteService.getClients();
  }

  createClient(client: any) {
    return this.venteService.createClient(client);
  }

  getCreditsParClient(nom: string) {
    return this.venteService.getCreditsParClient(nom);
  }

  getSoldeAvance(clientNom: string, clientTelephone?: string) {
    return this.venteService.getSoldeAvance(clientNom, clientTelephone);
  }

  getVentesDuJour() {
    return this.venteService.getVentesDuJour();
  }

  getAllCredits(): Observable<VenteMap[]> {
    return this.venteService.getAllCredits();
  }

  getCreditsNonRegles() {
    return this.venteService.getCreditsNonRegles();
  }

  getCreditsEnRetard() {
    return this.venteService.getCreditsEnRetard();
  }

  enregistrerReglementCredit(request: any) {
    return this.venteService.enregistrerReglementCredit(request);
  }

  appliquerRemiseGlobale(venteId: number, remise: number, type: any) {
    return this.venteService.appliquerRemiseGlobale(venteId, remise, type);
  }

  annulerRemiseGlobale(venteId: number) {
    return this.venteService.annulerRemiseGlobale(venteId);
  }

  modifierLignesVente(venteId: number, lignes: any[], motif?: string) {
    return this.venteService.modifierLignesVente(venteId, lignes, motif);
  }

  imprimerFacture(vente: VenteMap): void {
    return this.venteService.imprimerFacture(vente);
  }

  formatPrice(value: number): string {
    return this.venteService.formatPrice(value);
  }

  formatDate(value?: string): string {
    return this.venteService.formatDate(value);
  }

  getModePaiementLabel(mode: string): string {
    return this.venteService.getModePaiementLabel(mode);
  }

  getVenteCreditById(id: number): Observable<VenteMap> {
    return this.venteService.getVenteCreditById(id);
  }

  getVentePourModification(id: number, estCredit: boolean): Observable<VenteMap> {
    return this.venteService.getVentePourModification(id, estCredit);
  }
}
