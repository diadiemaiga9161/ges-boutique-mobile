import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type ActionPermission = 'VOIR' | 'GERER' | 'SUPPRIMER';

export interface MesPermissions {
  actif: boolean;
  toutAutorise: boolean;
  permissions: string[];
  roleNom: string;
}

export interface ModuleCatalogue {
  module: string;
  libelle: string;
  accessibleVendeur: boolean;
  actions: { action: ActionPermission; libelle: string; code: string }[];
}

export interface RoleBoutique {
  id: number;
  nom: string;
  description?: string;
  roleBase: 'ADMIN' | 'VENDEUR';
  systeme: boolean;
  verrouille: boolean;
  permissions: string[];
  nombreUtilisateurs: number;
}

export interface RoleBoutiqueRequest {
  nom: string;
  description?: string;
  roleBase: 'ADMIN' | 'VENDEUR';
  permissions: string[];
}

/**
 * Rôles et permissions personnalisés (fonctionnalité ROLES_PERSONNALISES activée par le
 * super admin). Sert à masquer menus, pages et boutons ; le vrai blocage est fait par le
 * serveur (PermissionInterceptor), qui renvoie un 403 ROLE_PERMISSION_DENIED.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly url = `${environment.apiUrl}/roles`;

  /** Chaque page (state du menu) appartient à une partie de l'application côté serveur. */
  /** Chaque écran (route) appartient à une partie de l'application côté serveur. */
  static readonly MODULE_PAR_PAGE: Record<string, string> = {
    '/tabs/sales': 'VENTES', '/cart': 'VENTES', '/credits': 'VENTES', '/tabs/factures': 'VENTES', '/resources/factures': 'VENTES', '/devis': 'VENTES',
    '/tabs/products': 'PRODUITS', '/promotions': 'PRODUITS', '/offres-quantite': 'PRODUITS',
    '/tabs/inventory': 'STOCK', '/comptage': 'STOCK', '/sorties': 'STOCK', '/tabs/transferts': 'STOCK', '/config-transferts': 'STOCK',
    '/clients': 'CLIENTS', '/clients-absents': 'RAPPORTS', '/tabs/clients': 'CLIENTS', '/resources/dettes': 'CLIENTS',
    '/commandes': 'COMMANDES',
    '/tabs/caisse': 'CAISSE', '/resources/comptes': 'CAISSE', '/mobile-money': 'CAISSE', '/depots': 'CAISSE', '/resources/depots-garde': 'CAISSE',
    '/tabs/benefices': 'FINANCES', '/depenses': 'DEPENSES', '/resultat-net': 'FINANCES',
    '/tabs/reports': 'RAPPORTS',
    '/fournisseurs': 'FOURNISSEURS', '/resources/fournisseurs': 'FOURNISSEURS', '/resources/objectifs-fournisseur': 'FOURNISSEURS', '/bonus-fournisseurs': 'FOURNISSEURS',
    '/resources/employes': 'PERSONNEL', '/resources/paiement-employe': 'PERSONNEL', '/resources/vendeurs': 'PERSONNEL',
    '/resources/objectifs-vendeur': 'PERSONNEL', '/historique-vendeur': 'PERSONNEL', '/classement-vendeurs': 'RAPPORTS', '/roles': 'PERSONNEL',
    '/primes-produits': 'PRIMES',
    '/boutique': 'ADMINISTRATION', '/facture-design': 'ADMINISTRATION', '/annulation-paiements': 'ADMINISTRATION',
    '/parametres-hub': 'ADMINISTRATION', '/parametres': 'ADMINISTRATION', '/journal-audit': 'ADMINISTRATION',
    '/export-donnees': 'ADMINISTRATION', '/sauvegardes': 'ADMINISTRATION',
    '/ia': 'IA', '/assistant-ia': 'IA'
  };


  private readonly aucuneRestriction: MesPermissions = { actif: false, toutAutorise: true, permissions: [], roleNom: '' };
  private mesPermissionsSubject = new BehaviorSubject<MesPermissions>(this.aucuneRestriction);
  public mesPermissions$ = this.mesPermissionsSubject.asObservable();
  /** true dès que les permissions de la personne connectée ont été lues (ou en échec). */
  private chargeSubject = new BehaviorSubject<boolean>(false);
  public charge$ = this.chargeSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) {
    this.authService.authenticated$.subscribe(ok => {
      if (ok) {
        this.chargeSubject.next(false);
        this.chargerMesPermissions();
      } else {
        this.mesPermissionsSubject.next(this.aucuneRestriction);
        this.chargeSubject.next(false);
      }
    });
  }

  chargerMesPermissions(): void {
    this.http.get<MesPermissions>(`${this.url}/mes-permissions`).pipe(
      // Ancien serveur ou erreur réseau : on ne restreint rien (le serveur reste maître).
      catchError(() => of(this.aucuneRestriction))
    ).subscribe(p => {
      this.mesPermissionsSubject.next(p);
      this.chargeSubject.next(true);
    });
  }

  /** La personne connectée peut-elle faire cette action dans cette partie ? */
  peut(module: string, action: ActionPermission = 'VOIR'): boolean {
    const p = this.mesPermissionsSubject.value;
    if (!p.actif || p.toutAutorise) return true;
    return p.permissions.includes(`${module}_${action}`);
  }

  /** La page (state du menu, ex: '/vente') est-elle visible pour la personne connectée ? */
  peutVoirPage(url: string): boolean {
    const chemin = (url || '').split(/[?#]/)[0];
    // Préfixe le plus long (ex: '/tabs/sales/12' -> '/tabs/sales').
    const cle = Object.keys(RoleService.MODULE_PAR_PAGE)
      .filter(k => chemin === k || chemin.startsWith(k + '/'))
      .sort((a, b) => b.length - a.length)[0];
    return !cle || this.peut(RoleService.MODULE_PAR_PAGE[cle], 'VOIR');
  }

  /** Les rôles personnalisés sont-ils activés pour la boutique ? */
  get rolesActifs(): boolean {
    return this.mesPermissionsSubject.value.actif;
  }

  get roleNom(): string {
    return this.mesPermissionsSubject.value.roleNom;
  }

  /** Nom du rôle à afficher, seulement quand les rôles personnalisés sont activés. */
  get nomRoleAffiche(): string {
    const p = this.mesPermissionsSubject.value;
    return p.actif ? p.roleNom || '' : '';
  }

  // ---------------------------------------------------------------- gestion (gérant)

  catalogue(): Observable<ModuleCatalogue[]> {
    return this.http.get<ModuleCatalogue[]>(`${this.url}/catalogue`);
  }

  lister(): Observable<RoleBoutique[]> {
    return this.http.get<RoleBoutique[]>(this.url);
  }

  creer(req: RoleBoutiqueRequest): Observable<RoleBoutique> {
    return this.http.post<RoleBoutique>(this.url, req);
  }

  modifier(id: number, req: RoleBoutiqueRequest): Observable<RoleBoutique> {
    return this.http.put<RoleBoutique>(`${this.url}/${id}`, req).pipe(tap(() => this.chargerMesPermissions()));
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Personnel de la boutique (pour attribuer les rôles). */
  utilisateurs(): Observable<{ id: number; username: string; nomComplet: string; role: string; actif: boolean; roleBoutiqueId?: number | null; superAdmin?: boolean }[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/utilisateurs`);
  }

  attribuer(utilisateurId: number, roleId: number | null): Observable<{ id: number; role: string; roleBoutiqueId: number | null; roleNom: string }> {
    return this.http.put<any>(`${this.url}/utilisateurs/${utilisateurId}`, { roleId });
  }
}
