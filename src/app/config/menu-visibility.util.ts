import { MenuItem } from './menu-items.config';

/** Contexte de visibilité du tiroir latéral — mêmes signaux que ceux déjà
 *  lus individuellement par chaque *ngIf dans l'ancien app.component.html. */
export interface MenuVisibilityContext {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  fonctionnalitesDesactivees: Set<string>;
  permissionInventaireLectureActive: boolean;
  /** Rôle (rôles personnalisés activés) qui fait les entrées/sorties de stock. */
  stockGererActif?: boolean;
  featureTransfertsActif: boolean;
  /** Rôles personnalisés (Caissier...) : la page est-elle permise au rôle connecté ? */
  peutVoirPage?: (route: string) => boolean;
}

/** Seule source de vérité pour l'affichage d'un item de menu — remplace les
 *  conditions *ngIf recopiées à la main sur chaque <ion-item> (source de
 *  l'incohérence "Inventaire" trouvée pendant l'audit de la refonte nav). */
export function canShowMenuItem(item: MenuItem, ctx: MenuVisibilityContext): boolean {
  if (item.superAdminOnly) return ctx.isSuperAdmin;

  if (ctx.peutVoirPage && !ctx.peutVoirPage(item.route)) return false;

  if (item.requiresInventairePermission) {
    return ctx.isAdmin || ctx.permissionInventaireLectureActive || !!ctx.stockGererActif;
  }

  if (item.adminOnly && !ctx.isAdmin) return false;

  if (item.requiresFeatureTransferts && !ctx.featureTransfertsActif) return false;

  if (item.featureFlagKey && ctx.fonctionnalitesDesactivees.has(item.featureFlagKey)) return false;

  return true;
}
