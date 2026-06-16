import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  // Routes accessibles uniquement aux admins
  private readonly ADMIN_ONLY_PATHS = [
    'caisse', 'inventory', 'reports',
    'boutique', 'resources'
  ];

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.auth.isAuthenticated()) {
      this.router.navigateByUrl('/login');
      return false;
    }

    // Vérifier les rôles explicites définis sur la route
    const roles = route.data['roles'] as string[] | undefined;
    if (roles?.length && !roles.some(role => this.auth.hasRole(role))) {
      this.router.navigateByUrl('/tabs/sales');
      return false;
    }

    // Si VENDEUR, bloquer les routes admin
    if (this.auth.isVendeur()) {
      const path = route.routeConfig?.path || '';
      const isAdminRoute = this.ADMIN_ONLY_PATHS.some(p => path.includes(p));
      if (isAdminRoute) {
        this.router.navigateByUrl('/tabs/sales');
        return false;
      }
    }

    return true;
  }

  canActivateChild(route: ActivatedRouteSnapshot): boolean {
    return this.canActivate(route);
  }
}
