import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface BoutiqueInfo {
  id?: number;
  nom: string;
  adresse?: string;
  telephone?: string;
  telephone2?: string;
  telephone3?: string;
  email?: string;
  logoUrl?: string;
  logoPath?: string;
  devise?: string;
  description?: string;
  numeroRc?: string;
  numeroIfu?: string;
  ville?: string;
  pays?: string;
  /** Activables/désactivables par le super admin (Boutique > Paramètres), vérifiés côté serveur. */
  featureTransfertsActif?: boolean;
  featureVitrineActif?: boolean;
}

export interface FonctionnaliteAvancee {
  cle: string;
  libelle: string;
  actif: boolean;
}

export interface PermissionVendeur {
  cle: string;
  libelle: string;
  actif: boolean;
}

const DEFAULT_BOUTIQUE: BoutiqueInfo = {
  nom: 'Boutique Alimentation',
  adresse: '',
  telephone: '',
  email: '',
  devise: 'FCFA',
  featureTransfertsActif: true,
  featureVitrineActif: true
};

@Injectable({
  providedIn: 'root'
})
export class BoutiqueService {
  private readonly apiUrl = `${environment.apiUrl}/boutique`;
  private readonly storeKey = 'boutique_info';
  private infoSubject = new BehaviorSubject<BoutiqueInfo>(this.readLocalInfo());

  info$ = this.infoSubject.asObservable();

  // Fonctionnalités avancées (Dépôt garde, Dettes anciennes, Comptes bancaires...) —
  // lues par TOUT le personnel connecté pour masquer les menus désactivés, modifiables
  // uniquement par le super admin. Système séparé de featureTransfertsActif/
  // featureVitrineActif ci-dessus (déjà en place, non touché).
  private fonctionnalitesAvanceesSubject = new BehaviorSubject<FonctionnaliteAvancee[]>([]);
  fonctionnalitesAvancees$ = this.fonctionnalitesAvanceesSubject.asObservable();

  // Permissions vendeur (système générique séparé, réutilisable pour d'autres permissions
  // plus tard — ne pas confondre avec fonctionnalitesAvancees ci-dessus qui est réservé au
  // super admin). Accordées par un ADMIN NORMAL (n'importe quel admin de la boutique) pour
  // donner au VENDEUR un accès en lecture seule à certaines pages (ex: Inventaire).
  private permissionsVendeurSubject = new BehaviorSubject<PermissionVendeur[]>([]);
  permissionsVendeur$ = this.permissionsVendeurSubject.asObservable();

  constructor(private http: HttpClient) {}

  getInfo(): BoutiqueInfo {
    return this.infoSubject.value;
  }

  getLogoPath(): string {
    return this.getInfo().logoUrl || 'assets/icon/favicon.png';
  }

  refreshBoutique(): Observable<BoutiqueInfo> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(response => {
        const info = response?.boutique || response?.data || response || DEFAULT_BOUTIQUE;
        return {
          ...info,
          logoUrl: info.logo || info.logoPath || info.logoUrl || ''
        };
      }),
      tap(info => this.persist(info)),
      catchError(() => of(this.getInfo()))
    );
  }

  getBoutique(): Observable<BoutiqueInfo> {
    return this.refreshBoutique();
  }

  updateBoutique(info: BoutiqueInfo): Observable<BoutiqueInfo> {
    const { logoUrl, logoPath, ...payload } = info as any;
    return this.http.put<any>(this.apiUrl, payload).pipe(
      map(response => {
        const updated = response?.boutique || response?.data || response || info;
        return { ...updated, logoUrl: updated.logo || updated.logoPath || logoUrl || '' };
      }),
      tap(updated => this.persist(updated))
    );
  }

  uploadLogo(file: File): Observable<string> {
    const formData = new FormData();
    formData.append('logo', file, file.name);
    return this.http.post<any>(`${this.apiUrl}/upload-logo`, formData).pipe(
      map(response => response?.logo || response?.logoPath || response?.logoUrl || response?.url || ''),
      tap(logoUrl => this.persist({ ...this.getInfo(), logoUrl }))
    );
  }

  resetToDefaults(): Observable<BoutiqueInfo> {
    this.persist(DEFAULT_BOUTIQUE);
    return of(DEFAULT_BOUTIQUE);
  }

  /** Réservé au super admin — voir AuthService.isSuperAdmin(). Le serveur revérifie
   *  systématiquement le privilège (403 sinon), cette méthode ne fait aucun contrôle
   *  d'accès côté client. */
  modifierFonctionnalites(featureTransfertsActif: boolean, featureVitrineActif: boolean): Observable<BoutiqueInfo> {
    return this.http.put<any>(`${this.apiUrl}/fonctionnalites`, { featureTransfertsActif, featureVitrineActif }).pipe(
      map(response => {
        const updated = response?.boutique || response?.data || response;
        return { ...updated, logoUrl: updated.logo || updated.logoPath || updated.logoUrl || '' };
      }),
      tap(updated => this.persist(updated))
    );
  }

  private readLocalInfo(): BoutiqueInfo {
    const raw = localStorage.getItem(this.storeKey);
    if (!raw) return DEFAULT_BOUTIQUE;

    try {
      return { ...DEFAULT_BOUTIQUE, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_BOUTIQUE;
    }
  }

  private persist(info: BoutiqueInfo): void {
    const value = { ...DEFAULT_BOUTIQUE, ...info };
    localStorage.setItem(this.storeKey, JSON.stringify(value));
    this.infoSubject.next(value);
  }

  /** Lecture ouverte à tout le personnel (ADMIN/VENDEUR) — voir GET /api/boutique/fonctionnalites-avancees.
   *  À appeler après connexion (voir app.component.ts) pour peupler fonctionnalitesAvancees$. */
  chargerFonctionnalitesAvancees(): Observable<FonctionnaliteAvancee[]> {
    return this.http.get<any>(`${this.apiUrl}/fonctionnalites-avancees`).pipe(
      map(response => (response?.fonctionnalites || []) as FonctionnaliteAvancee[]),
      tap(liste => this.fonctionnalitesAvanceesSubject.next(liste)),
      catchError(() => of([]))
    );
  }

  /** Réservé au super admin — le serveur revérifie systématiquement le privilège (403 sinon). */
  definirFonctionnaliteAvancee(cle: string, actif: boolean): Observable<FonctionnaliteAvancee[]> {
    return this.http.put<any>(`${this.apiUrl}/fonctionnalites-avancees/${cle}`, { actif }).pipe(
      map(response => (response?.fonctionnalites || []) as FonctionnaliteAvancee[]),
      tap(liste => this.fonctionnalitesAvanceesSubject.next(liste))
    );
  }

  /** Lecture ouverte à tout le personnel (ADMIN/VENDEUR) — voir GET /api/boutique/permissions-vendeur.
   *  À appeler après connexion (voir app.component.ts) pour peupler permissionsVendeur$.
   *  Attention : la clé du tableau dans la réponse est `permissions` (pas `fonctionnalites`). */
  chargerPermissionsVendeur(): Observable<PermissionVendeur[]> {
    return this.http.get<any>(`${this.apiUrl}/permissions-vendeur`).pipe(
      map(response => (response?.permissions || []) as PermissionVendeur[]),
      tap(liste => this.permissionsVendeurSubject.next(liste)),
      catchError(() => of([]))
    );
  }

  /** Réservé à un ADMIN (n'importe quel admin de la boutique, pas besoin de super admin) —
   *  le serveur revérifie systématiquement le privilège (403 sinon). */
  definirPermissionVendeur(cle: string, actif: boolean): Observable<PermissionVendeur[]> {
    return this.http.put<any>(`${this.apiUrl}/permissions-vendeur/${cle}`, { actif }).pipe(
      map(response => (response?.permissions || []) as PermissionVendeur[]),
      tap(liste => this.permissionsVendeurSubject.next(liste))
    );
  }
}
