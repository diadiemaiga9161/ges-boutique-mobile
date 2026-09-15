/** Un item du tiroir latéral (app.component.html). Remplace les ~39 <ion-item>
 *  codés en dur qui dupliquaient chacun leur propre condition d'affichage
 *  (rôle, feature flag, permission vendeur) — source de l'incohérence trouvée
 *  sur "Inventaire" pendant l'audit de la refonte navigation. La visibilité
 *  de chaque item est calculée par canShowMenuItem() (menu-visibility.util.ts),
 *  seule source de vérité, au lieu d'un *ngIf recopié à chaque entrée. */
export interface MenuItem {
  /** Clé i18n du libellé, si l'item est déjà traduit dans les fichiers assets/i18n/*.json. */
  titleKey?: string;
  /** Libellé littéral (FR), pour les items jamais passés par le pipe `translate`
   *  aujourd'hui — on ne les fait pas passer par `translate` pour ne pas dépendre
   *  du comportement de repli d'ngx-translate sur une clé absente. */
  title?: string;
  icon: string;
  /** Couleur Ionic optionnelle de l'icône (ex: 'warning', 'danger'), comme
   *  aujourd'hui sur "Paramètres" et "Annulation paiements". */
  iconColor?: string;
  route: string;
  /** Visible uniquement pour un ADMIN (y compris un super admin, qui est un ADMIN
   *  avec le flag superAdmin=true — voir AuthService.isSuperAdmin). */
  adminOnly?: boolean;
  /** Visible uniquement pour un super admin (implique adminOnly, pas besoin de
   *  cumuler les deux). */
  superAdminOnly?: boolean;
  /** Masqué si `fonctionnalitesDesactivees.has(featureFlagKey)` (fonctionnalité
   *  désactivée par le super admin). */
  featureFlagKey?: string;
  /** Cas particulier "Inventaire" : visible pour un ADMIN OU un VENDEUR avec la
   *  permission "Inventaire en lecture seule" accordée — pas un simple adminOnly. */
  requiresInventairePermission?: boolean;
  /** Masqué si featureTransfertsActif===false (flag distinct de fonctionnalitesDesactivees,
   *  porté par BoutiqueService.info$ — voir app.component.ts). */
  requiresFeatureTransferts?: boolean;
  /** Affiche le badge de notifications non lues (comme la cloche du header). */
  showNotificationBadge?: boolean;
}

export interface MenuSection {
  /** Clé i18n du titre de section, absente pour la section commune (pas de
   *  libellé) et pour la section finale Compte (pas de libellé non plus,
   *  seulement un séparateur visuel avant). */
  labelKey?: string;
  items: MenuItem[];
}

/** Sections dans l'ordre d'affichage exact du tiroir actuel. Une section sans
 *  aucun item visible (ex: "Transferts" quand featureTransfertsActif=false)
 *  disparaît entièrement (label + séparateur inclus) — voir app.component.ts,
 *  get visibleMenuSections(). */
export const MENU_SECTIONS: MenuSection[] = [
  {
    // Section commune, jamais vide (aucun item conditionné par adminOnly/flag
    // sauf Sorties/Caisse) — garde le même label 'NAV.MORE' qu'aujourd'hui.
    labelKey: 'NAV.MORE',
    items: [
      { title: 'Dashboard', icon: 'home-outline', route: '/home' },
      { titleKey: 'NAV.SALES', icon: 'receipt-outline', route: '/tabs/sales' },
      { titleKey: 'SALES.NEW', icon: 'cart-outline', route: '/cart' },
      { titleKey: 'NAV.CLIENTS', icon: 'people-outline', route: '/clients' },
      { titleKey: 'NAV.CREDITS', icon: 'time-outline', route: '/credits' },
      { titleKey: 'NAV.INVENTORY', icon: 'clipboard-outline', route: '/tabs/inventory', requiresInventairePermission: true },
      { title: 'Sorties Stock', icon: 'arrow-down-circle-outline', route: '/sorties', adminOnly: true },
      { titleKey: 'NAV.CAISSE', icon: 'cash-outline', route: '/tabs/caisse', adminOnly: true },
    ]
  },
  {
    labelKey: 'MENU.FINANCES',
    items: [
      { titleKey: 'NAV.INVOICES', icon: 'document-text-outline', route: '/resources/factures', adminOnly: true },
      { titleKey: 'NAV.BANK', icon: 'card-outline', route: '/resources/comptes', adminOnly: true, featureFlagKey: 'COMPTES_BANCAIRES' },
      { titleKey: 'NAV.DEBTS', icon: 'alert-circle-outline', route: '/resources/dettes', adminOnly: true, featureFlagKey: 'DETTES_ANCIENNES' },
    ]
  },
  {
    labelKey: 'MENU.HR',
    items: [
      { titleKey: 'NAV.EMPLOYEES', icon: 'person-add-outline', route: '/resources/employes', adminOnly: true },
      { titleKey: 'NAV.EMPLOYEE_PAY', icon: 'wallet-outline', route: '/resources/paiement-employe', adminOnly: true },
    ]
  },
  {
    labelKey: 'BOUTIQUE_SETTINGS.TITLE',
    items: [
      { titleKey: 'NAV.SUPPLIERS', icon: 'business-outline', route: '/fournisseurs', adminOnly: true },
      { titleKey: 'NAV.SAFE', icon: 'lock-closed-outline', route: '/depots', adminOnly: true, featureFlagKey: 'DEPOT_GARDE' },
      { titleKey: 'NAV.SUPPLIER_OBJ', icon: 'trophy-outline', route: '/resources/objectifs-fournisseur', adminOnly: true, featureFlagKey: 'OBJECTIFS_FOURNISSEUR' },
      { titleKey: 'NAV.SELLER_BONUS', icon: 'cash-outline', route: '/resources/objectifs-vendeur', adminOnly: true, featureFlagKey: 'OBJECTIFS_VENDEUR' },
      { titleKey: 'NAV.SELLERS', icon: 'people-circle-outline', route: '/resources/vendeurs', adminOnly: true },
      { titleKey: 'NAV.SHOP', icon: 'storefront-outline', route: '/boutique', adminOnly: true },
      { title: 'Fonctionnalités (super admin)', icon: 'shield-checkmark-outline', route: '/super-admin-fonctionnalites', superAdminOnly: true },
      { titleKey: 'NAV.INVOICE_DESIGN', icon: 'color-palette-outline', route: '/facture-design', adminOnly: true },
      { titleKey: 'LANG.SELECT', icon: 'language-outline', route: '/langue', adminOnly: true },
    ]
  },
  {
    labelKey: 'NAV.TRANSFERS',
    items: [
      // Les 2 items ci-dessous n'ont pas de condition individuelle dans l'ancien
      // template : c'est le ng-container englobant (*ngIf="featureTransfertsActif")
      // qui gate toute la section — reproduit ici via requiresFeatureTransferts.
      { titleKey: 'NAV.TRANSFERS', icon: 'swap-horizontal-outline', route: '/tabs/transferts', adminOnly: true, requiresFeatureTransferts: true },
      { titleKey: 'MENU.CONFIG_PARTNERS', icon: 'settings-outline', route: '/config-transferts', adminOnly: true, requiresFeatureTransferts: true },
    ]
  },
  {
    labelKey: 'MENU.ANALYSES',
    items: [
      { titleKey: 'NAV.REPORTS', icon: 'stats-chart-outline', route: '/tabs/reports', adminOnly: true },
      { titleKey: 'IA.TITLE', icon: 'sparkles-outline', iconColor: 'warning', route: '/ia', adminOnly: true, featureFlagKey: 'IA' },
      { titleKey: 'NAV.BENEFITS', icon: 'trending-up-outline', route: '/tabs/benefices', adminOnly: true },
      { titleKey: 'NAV.SUPPLIER_BONUS', icon: 'gift-outline', route: '/bonus-fournisseurs', adminOnly: true, featureFlagKey: 'BONUS_FOURNISSEURS' },
      { titleKey: 'NAV.EXPENSES', icon: 'trending-down-outline', route: '/depenses', adminOnly: true },
      { titleKey: 'NAV.PROMO', icon: 'pricetag-outline', route: '/promotions', adminOnly: true, featureFlagKey: 'PROMOTIONS' },
      { titleKey: 'NAV.NET_RESULT', icon: 'analytics-outline', route: '/resultat-net', adminOnly: true, featureFlagKey: 'RESULTAT_NET' },
      { title: 'Historique vendeur', icon: 'bar-chart-outline', route: '/historique-vendeur', adminOnly: true },
      { title: 'Annulation paiements', icon: 'close-circle-outline', iconColor: 'danger', route: '/annulation-paiements', adminOnly: true },
      { titleKey: 'EXPORT.TITRE', icon: 'cloud-download-outline', route: '/export-donnees', adminOnly: true },
      { titleKey: 'JOURNAL_AUDIT.TITRE', icon: 'shield-checkmark-outline', route: '/journal-audit', adminOnly: true },
      { titleKey: 'BACKUP.TITLE', icon: 'archive-outline', route: '/sauvegardes', adminOnly: true },
      { titleKey: 'PARAMETRES.TITRE', icon: 'settings-outline', iconColor: 'warning', route: '/parametres-hub', adminOnly: true },
      { titleKey: 'NAV.NOTIFICATIONS', icon: 'notifications-outline', route: '/tabs/notifications', adminOnly: true, showNotificationBadge: true },
    ]
  },
  {
    // Pas de labelKey (section "Compte", jamais eu de titre) mais toujours
    // précédée d'un séparateur, y compris pour un VENDEUR (voir app.component.html
    // d'origine ligne 273 : le <div class="menu-divider"> n'est PAS à l'intérieur
    // du ng-container admin, contrairement aux autres séparateurs).
    items: [
      { titleKey: 'PROFILE.TITLE', icon: 'person-circle-outline', route: '/profile' },
      { titleKey: 'RESSOURCES.TITRE', icon: 'information-circle-outline', route: '/a-propos' },
    ]
  }
];
