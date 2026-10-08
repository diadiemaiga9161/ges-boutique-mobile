import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, filter, map, race, switchMap, take, timer } from 'rxjs';
import { AuthService } from './auth.service';
import { BoutiqueService } from './boutique.service';
import { RoleService } from './role.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private auth: AuthService,
    private router: Router,
    private roleService: RoleService,
    private boutiqueService: BoutiqueService
  ) {}

  // Routes accessibles uniquement aux admins
  private readonly ADMIN_ONLY_PATHS = [
    'caisse', 'inventory', 'reports',
    'boutique', 'resources'
  ];

  canActivate(route: ActivatedRouteSnapshot, state?: RouterStateSnapshot): boolean | Observable<boolean | UrlTree> {
    if (!this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/login');
      return false;
    }

    // Vérifier les rôles explicites définis sur la route
    const roles = route.data['roles'] as string[] | undefined;
    if (roles?.length && !roles.some(role => this.auth.hasRole(role))) {
      this.router.navigateByUrl('/tabs/home');
      return false;
    }

    // Page super admin (flag super_admin en base, pas un rôle séparé — voir
    // AuthService.isSuperAdmin) : bloque même un ADMIN classique.
    if (route.data['superAdminOnly'] && !this.auth.isSuperAdmin()) {
      this.router.navigateByUrl('/tabs/home');
      return false;
    }

    // Si VENDEUR, bloquer les routes admin
    if (this.auth.isVendeur()) {
      const path = route.routeConfig?.path || '';
      // Inventaire en lecture : permis si le gérant a coché « Consultation de l'inventaire ».
      // La permission est relue ici : au lancement de l'appli elle n'est pas encore chargée.
      if (path === 'inventory') {
        return this.apresPermissions().pipe(
          switchMap(() => this.boutiqueService.chargerPermissionsVendeur()),
          map(liste => {
            const lecture = liste.some(p => p.cle === 'INVENTAIRE_LECTURE' && p.actif)
              // Vendeur dont le rôle fait les entrées/sorties : il voit aussi l'inventaire.
              || (this.roleService.rolesActifs && this.roleService.peut('STOCK', 'GERER'));
            const permis = lecture && (!state || this.roleService.peutVoirPage(state.url));
            return permis ? true : this.router.parseUrl('/tabs/home');
          })
        );
      }
      const isAdminRoute = this.ADMIN_ONLY_PATHS.some(p => path.includes(p));
      if (isAdminRoute) {
        this.router.navigateByUrl('/tabs/home');
        return false;
      }
    }

    // Rôles personnalisés (Caissier...) : page non permise au rôle connecté. Le serveur
    // bloque de toute façon les données ; ici on évite d'ouvrir un écran vide.
    // On attend les permissions : au démarrage direct sur une page (rechargement, lien,
    // appli installée qui rouvre la dernière page) elles ne sont pas encore chargées et
    // la page s'ouvrait alors sans contrôle.
    if (!state) return true;
    return this.apresPermissions().pipe(
      map(() => this.roleService.peutVoirPage(state.url) ? true : this.router.parseUrl('/tabs/home'))
    );
  }

  /** Attend les permissions de la personne connectée (au plus 4 s : sans réponse, le
   *  serveur reste seul juge, comme sur le site). */
  private apresPermissions(): Observable<unknown> {
    return race(
      this.roleService.charge$.pipe(filter(ok => ok)),
      timer(4000)
    ).pipe(take(1));
  }

  canActivateChild(route: ActivatedRouteSnapshot, state?: RouterStateSnapshot): boolean | Observable<boolean | UrlTree> {
    return this.canActivate(route, state);
  }
}
