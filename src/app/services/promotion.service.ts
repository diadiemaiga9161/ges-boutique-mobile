import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Promotion {
  id?: number;
  titre: string;
  description?: string;
  dateDebut: string;
  dateFin: string;
  typeReduction: 'POURCENTAGE' | 'MONTANT_FIXE';
  valeurReduction: number;
  active: boolean;
  globale?: boolean;
  produitIds?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface WhatsAppLien {
  nom: string;
  telephone: string;
  url: string;
}

export interface WhatsAppResult {
  promotion: Promotion;
  message: string;
  liens: WhatsAppLien[];
  totalClients: number;
  clientsAvecTelephone: number;
  clientsSansTelephone: number;
}

@Injectable({ providedIn: 'root' })
export class PromotionService {

  private readonly apiUrl = `${environment.apiUrl}/promotions`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Promotion[]> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(r => r.promotions || []),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur chargement promotions')))
    );
  }

  getActives(): Observable<Promotion[]> {
    return this.http.get<any>(`${this.apiUrl}/actives`).pipe(
      map(r => r.promotions || []),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur')))
    );
  }

  creer(promo: Partial<Promotion>): Observable<Promotion> {
    return this.http.post<any>(this.apiUrl, promo).pipe(
      map(r => r.promotion || r),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur création')))
    );
  }

  modifier(id: number, promo: Partial<Promotion>): Observable<Promotion> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, promo).pipe(
      map(r => r.promotion || r),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur modification')))
    );
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => void 0),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur suppression')))
    );
  }

  preparerWhatsApp(id: number): Observable<WhatsAppResult> {
    return this.http.get<any>(`${this.apiUrl}/${id}/whatsapp`).pipe(
      map(r => r as WhatsAppResult),
      catchError(e => throwError(() => new Error(e?.error?.message || 'Erreur WhatsApp')))
    );
  }

  getPromosPourProduit(produitId: number): Observable<Promotion[]> {
    return this.http.get<any>(`${this.apiUrl}/produit/${produitId}`).pipe(
      map(r => r.promotions || []),
      catchError(() => throwError(() => new Error('Erreur chargement promos produit')))
    );
  }

  calculerPrixPromo(prixOriginal: number, promo: Promotion): number {
    if (promo.typeReduction === 'POURCENTAGE') {
      return Math.round(prixOriginal * (1 - promo.valeurReduction / 100));
    }
    return Math.max(0, prixOriginal - promo.valeurReduction);
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value) + ' FCFA';
  }

  getStatut(promo: Promotion): { label: string; color: string } {
    if (!promo.active) return { label: 'Inactive', color: 'medium' };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const debut = new Date(promo.dateDebut);
    const fin = new Date(promo.dateFin);
    if (fin < today) return { label: 'Expirée', color: 'danger' };
    if (debut > today) return { label: 'À venir', color: 'primary' };
    return { label: 'En cours', color: 'success' };
  }
}
