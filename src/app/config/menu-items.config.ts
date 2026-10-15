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
  /** Identifiant stable (groupe ouvert mémorisé, trackBy). */
  id: string;
  /** Clé i18n du titre de section. */
  labelKey?: string;
  /** Titre littéral (FR), pour les sections jamais traduites. */
  label?: string;
  /** Groupe repliable : fermé par défaut, un seul ouvert à la fois. */
  repliable?: boolean;
  /** Icône de l'en-tête d'un groupe repliable. */
  icon?: string;
  items: MenuItem[];
}

/** Sections dans l'ordre d'affichage exact du tiroir actuel. Une section sans
 *  aucun item visible (ex: "Transferts" quand featureTransfertsActif=false)
 *  disparaît entièrement (label + séparateur inclus) — voir app.component.ts,
 *  get visibleMenuSections(). */
export const MENU_SECTIONS: MenuSection[] = [
  // Toujours visible : ce qui sert tous les jours. Le reste est rangé dans des groupes
  // repliables pour que le tiroir tienne sur un écran (demande utilisateur du 15/10/2026).
  // Boutique, Design de facture, Langue, Export, Journal d'audit, Sauvegardes et
  // Notifications ne sont plus ici : ils sont dans la page Paramètres (parametres-hub).
  {
    id: 'essentiel',
    label: 'Essentiel',
    items: [
      { title: 'Dashboard', icon: 'home-outline', route: '/home' },
      { titleKey: 'SALES.NEW', icon: 'cart-outline', route: '/cart' },
      { titleKey: 'NAV.SALES', icon: 'receipt-outline', route: '/tabs/sales' },
      { titleKey: 'NAV.CLIENTS', icon: 'people-outline', route: '/clients' },
      { titleKey: 'NAV.CREDITS', icon: 'time-outline', route: '/credits' },
      { titleKey: 'NAV.CAISSE', icon: 'cash-outline', route: '/tabs/caisse', adminOnly: true },
      { titleKey: 'NAV.INVENTORY', icon: 'clipboard-outline', route: '/tabs/inventory', requiresInventairePermission: true },
      { titleKey: 'NAV.EXPENSES', icon: 'trending-down-outline', route: '/depenses', adminOnly: true },
    ]
  },
  {
    id: 'ventes',
    label: 'Ventes et clients',
    repliable: true,
    icon: 'pricetags-outline',
    items: [
      { title: 'Clients à rappeler', icon: 'call-outline', route: '/clients-absents', adminOnly: true, featureFlagKey: 'CLIENTS_ABSENTS' },
      { title: 'Devis', icon: 'clipboard-outline', route: '/devis', adminOnly: true, featureFlagKey: 'DEVIS' },
      { titleKey: 'NAV.INVOICES', icon: 'document-text-outline', route: '/resources/factures', adminOnly: true },
      { title: 'Offres par quantité', icon: 'gift-outline', route: '/offres-quantite', adminOnly: true, featureFlagKey: 'OFFRES_QUANTITE' },
      { titleKey: 'NAV.PROMO', icon: 'pricetag-outline', route: '/promotions', adminOnly: true, featureFlagKey: 'PROMOTIONS' },
      { title: 'Annulation paiements', icon: 'close-circle-outline', iconColor: 'danger', route: '/annulation-paiements', adminOnly: true },
    ]
  },
  {
    id: 'stock',
    label: 'Stock et fournisseurs',
    repliable: true,
    icon: 'cube-outline',
    items: [
      { title: 'Sorties Stock', icon: 'arrow-down-circle-outline', route: '/sorties', adminOnly: true },
      { titleKey: 'NAV.SUPPLIERS', icon: 'business-outline', route: '/fournisseurs', adminOnly: true },
      { titleKey: 'NAV.SUPPLIER_OBJ', icon: 'trophy-outline', route: '/resources/objectifs-fournisseur', adminOnly: true, featureFlagKey: 'OBJECTIFS_FOURNISSEUR' },
      { titleKey: 'NAV.SUPPLIER_BONUS', icon: 'gift-outline', route: '/bonus-fournisseurs', adminOnly: true, featureFlagKey: 'BONUS_FOURNISSEURS' },
      { titleKey: 'NAV.SAFE', icon: 'lock-closed-outline', route: '/depots', adminOnly: true, featureFlagKey: 'DEPOT_GARDE' },
      // Transferts : même règle qu'avant (flag distinct porté par BoutiqueService.info$).
      { titleKey: 'NAV.TRANSFERS', icon: 'swap-horizontal-outline', route: '/tabs/transferts', adminOnly: true, requiresFeatureTransferts: true },
      { titleKey: 'MENU.CONFIG_PARTNERS', icon: 'settings-outline', route: '/config-transferts', adminOnly: true, requiresFeatureTransferts: true },
    ]
  },
  {
    id: 'equipe',
    label: 'Équipe',
    repliable: true,
    icon: 'people-circle-outline',
    items: [
      { titleKey: 'NAV.SELLERS', icon: 'people-circle-outline', route: '/resources/vendeurs', adminOnly: true },
      { titleKey: 'NAV.EMPLOYEES', icon: 'person-add-outline', route: '/resources/employes', adminOnly: true },
      { titleKey: 'NAV.EMPLOYEE_PAY', icon: 'wallet-outline', route: '/resources/paiement-employe', adminOnly: true },
      { title: 'Primes sur produits', icon: 'ribbon-outline', route: '/primes-produits', adminOnly: true, featureFlagKey: 'PRIMES_PRODUITS' },
      { titleKey: 'NAV.SELLER_BONUS', icon: 'cash-outline', route: '/resources/objectifs-vendeur', adminOnly: true, featureFlagKey: 'OBJECTIFS_VENDEUR' },
      { title: 'Historique vendeur', icon: 'bar-chart-outline', route: '/historique-vendeur', adminOnly: true },
      { title: 'Classement des vendeurs', icon: 'trophy-outline', route: '/classement-vendeurs', adminOnly: true },
      { title: 'Rôles et permissions', icon: 'key-outline', route: '/roles', adminOnly: true, featureFlagKey: 'ROLES_PERSONNALISES' },
    ]
  },
  {
    id: 'analyses',
    label: 'Argent et analyses',
    repliable: true,
    icon: 'stats-chart-outline',
    items: [
      { titleKey: 'NAV.REPORTS', icon: 'stats-chart-outline', route: '/tabs/reports', adminOnly: true },
      { titleKey: 'NAV.BENEFITS', icon: 'trending-up-outline', route: '/tabs/benefices', adminOnly: true },
      { titleKey: 'NAV.NET_RESULT', icon: 'analytics-outline', route: '/resultat-net', adminOnly: true, featureFlagKey: 'RESULTAT_NET' },
      { titleKey: 'NAV.BANK', icon: 'card-outline', route: '/resources/comptes', adminOnly: true, featureFlagKey: 'COMPTES_BANCAIRES' },
      { titleKey: 'NAV.DEBTS', icon: 'alert-circle-outline', route: '/resources/dettes', adminOnly: true, featureFlagKey: 'DETTES_ANCIENNES' },
      { titleKey: 'IA.TITLE', icon: 'sparkles-outline', iconColor: 'warning', route: '/ia', adminOnly: true, featureFlagKey: 'IA' },
    ]
  },
  {
    id: 'parametres',
    items: [
      { titleKey: 'PARAMETRES.TITRE', icon: 'settings-outline', iconColor: 'warning', route: '/parametres-hub', adminOnly: true },
      { title: 'Fonctionnalités (super admin)', icon: 'shield-checkmark-outline', route: '/super-admin-fonctionnalites', superAdminOnly: true },
    ]
  },
  {
    id: 'compte',
    label: 'Mon compte',
    repliable: true,
    icon: 'person-circle-outline',
    items: [
      { titleKey: 'PROFILE.TITLE', icon: 'person-circle-outline', route: '/profile' },
      { title: 'Mes primes', icon: 'gift-outline', route: '/mes-primes', featureFlagKey: 'PRIMES_PRODUITS' },
      { title: 'Mon pointage', icon: 'finger-print-outline', route: '/pointage', featureFlagKey: 'POINTAGE' },
      { title: 'Planning', icon: 'calendar-outline', route: '/planning', featureFlagKey: 'PLANNING' },
      { title: 'Mode entraînement', icon: 'school-outline', route: '/entrainement', featureFlagKey: 'MODE_ENTRAINEMENT' },
      { titleKey: 'RESSOURCES.TITRE', icon: 'information-circle-outline', route: '/a-propos' },
    ]
  }
];
