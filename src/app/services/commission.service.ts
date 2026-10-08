import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TypeCommission = 'MONTANT_FIXE' | 'POURCENTAGE' | 'OBJECTIF';

export interface RegleCommission {
  id: number;
  nom: string;
  type: TypeCommission;
  typeLibelle: string;
  produitId?: number | null;
  produitNom?: string | null;
  uniteBase?: string;
  categorieId?: number | null;
  categorieNom?: string | null;
  valeur: number;
  quantiteObjectif?: number | null;
  dateDebut: string;
  dateFin?: string | null;
  vendeurId?: number | null;
  vendeurNom?: string | null;
  statut: 'A_VENIR' | 'EN_COURS' | 'TERMINEE';
  // Présents dans les détails de calcul / "mes primes"
  quantiteVendue?: number;
  montantVendu?: number;
  prime?: number;
  objectifAtteint?: boolean;
}

export interface RegleCommissionRequest {
  nom?: string;
  type: TypeCommission;
  produitId?: number | null;
  categorieId?: number | null;
  valeur: number | null;
  quantiteObjectif?: number | null;
  dateDebut: string;
  dateFin?: string | null;
  vendeurId?: number | null;
}

export interface PrimeVendeur {
  vendeurId: number;
  vendeurNom: string;
  primePeriode: number;
  payePeriode: number;
  primeTotale: number;
  payeTotal: number;
  resteAPayer: number;
  details: RegleCommission[];
}

export interface CalculPrimes {
  debut: string;
  fin: string;
  totalPeriode: number;
  totalResteAPayer: number;
  vendeurs: PrimeVendeur[];
}

export interface PaiementCommission {
  id: number;
  vendeurId: number;
  vendeurNom: string;
  montant: number;
  datePaiement: string;
  note?: string;
  enregistrePar?: string;
}

export interface MesPrimes {
  debut: string;
  fin: string;
  resume: PrimeVendeur | null;
  reglesEnCours: RegleCommission[];
  paiements: PaiementCommission[];
}

export interface TypeParametre {
  type: TypeCommission;
  libelle: string;
  actif: boolean;
}

/** Primes sur produits (fonctionnalité PRIMES_PRODUITS activée par le super admin). */
@Injectable({ providedIn: 'root' })
export class CommissionService {
  private readonly url = `${environment.apiUrl}/commissions`;

  constructor(private http: HttpClient) {}

  fmt(m: number | null | undefined): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(m || 0) + ' FCFA';
  }

  /** Phrase lisible de la condition, ex : "100 FCFA par Unité vendue". */
  decrire(r: RegleCommission): string {
    const unite = (r.uniteBase || 'unité').toLowerCase();
    switch (r.type) {
      case 'MONTANT_FIXE': return `${this.fmt(r.valeur)} par ${unite} vendue`;
      case 'POURCENTAGE': return `${r.valeur} % du montant vendu`;
      case 'OBJECTIF': return `${this.fmt(r.valeur)} si ${r.quantiteObjectif} ${unite}(s) vendue(s)`;
    }
  }

  /** Format AAAA-MM-JJ local (pas toISOString, qui décale d'un jour selon le fuseau). */
  static iso(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  private periode(debut?: string, fin?: string): HttpParams {
    let p = new HttpParams();
    if (debut) p = p.set('debut', debut);
    if (fin) p = p.set('fin', fin);
    return p;
  }

  mesPrimes(debut?: string, fin?: string): Observable<MesPrimes> {
    return this.http.get<MesPrimes>(`${this.url}/mes-primes`, { params: this.periode(debut, fin) });
  }

  primes(debut?: string, fin?: string): Observable<CalculPrimes> {
    return this.http.get<CalculPrimes>(`${this.url}/primes`, { params: this.periode(debut, fin) });
  }

  parametres(): Observable<{ types: TypeParametre[] }> {
    return this.http.get<{ types: TypeParametre[] }>(`${this.url}/parametres`);
  }

  definirTypes(types: TypeCommission[]): Observable<{ types: TypeParametre[] }> {
    return this.http.put<{ types: TypeParametre[] }>(`${this.url}/parametres`, { types });
  }

  vendeurs(): Observable<{ id: number; nomComplet: string }[]> {
    return this.http.get<{ id: number; nomComplet: string }[]>(`${this.url}/vendeurs`);
  }

  regles(): Observable<RegleCommission[]> {
    return this.http.get<RegleCommission[]>(`${this.url}/regles`);
  }

  creerRegle(req: RegleCommissionRequest): Observable<RegleCommission> {
    return this.http.post<RegleCommission>(`${this.url}/regles`, req);
  }

  modifierRegle(id: number, req: RegleCommissionRequest): Observable<RegleCommission> {
    return this.http.put<RegleCommission>(`${this.url}/regles/${id}`, req);
  }

  arreterRegle(id: number): Observable<RegleCommission> {
    return this.http.patch<RegleCommission>(`${this.url}/regles/${id}/arreter`, {});
  }

  supprimerRegle(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/regles/${id}`);
  }

  paiements(vendeurId?: number): Observable<PaiementCommission[]> {
    const params = vendeurId ? new HttpParams().set('vendeurId', vendeurId) : undefined;
    return this.http.get<PaiementCommission[]>(`${this.url}/paiements`, { params });
  }

  payer(vendeurId: number, montant: number, note?: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.url}/paiements`, { vendeurId, montant, note });
  }

  supprimerPaiement(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/paiements/${id}`);
  }
}
