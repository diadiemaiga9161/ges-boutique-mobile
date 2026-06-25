import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './services/auth.guard';

const routes: Routes = [
  {
    path: 'boutique-select',
    loadChildren: () => import('./pages/boutique-select/boutique-select.module').then(m => m.BoutiqueSelectPageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'forgot-password',
    loadChildren: () => import('./pages/forgot-password/forgot-password.module').then(m => m.ForgotPasswordPageModule)
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./pages/reset-password/reset-password.module').then(m => m.ResetPasswordPageModule)
  },
  {
    path: 'tabs',
    canActivate: [AuthGuard],
    canActivateChild: [AuthGuard],
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
  },
  {
    path: 'home',
    canActivate: [AuthGuard],
    loadChildren: () => import('./home/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'cart',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/cart/cart.module').then(m => m.CartPageModule)
  },
  {
    path: 'clients',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/clients/clients.module').then(m => m.ClientsPageModule)
  },
  {
    path: 'boutique',
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] },
    loadChildren: () => import('./pages/boutique-settings/boutique-settings.module').then(m => m.BoutiqueSettingsPageModule)
  },
  {
    path: 'resources/:type',
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] },
    loadChildren: () => import('./pages/resources/resources.module').then(m => m.ResourcesPageModule)
  },
  {
    path: 'profile',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/profile/profile.module').then(m => m.ProfilePageModule)
  },
  {
    path: 'depenses',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/depenses/depenses.module').then(m => m.DepensesPageModule)
  },
  {
    path: 'credits',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/credits/credits.module').then(m => m.CreditsPageModule)
  },
  {
    path: 'fournisseurs',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/fournisseurs/fournisseurs.module').then(m => m.FournisseursPageModule)
  },
  {
    path: 'depots',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/depots/depots.module').then(m => m.DepotsPageModule)
  },
  {
    path: 'config-transferts',
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] },
    loadChildren: () => import('./pages/config-transferts/config-transferts.module').then(m => m.ConfigTransfertsPageModule)
  },
  {
    path: 'bonus-fournisseurs',
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] },
    loadChildren: () => import('./pages/bonus-fournisseurs/bonus-fournisseurs.module').then(m => m.BonusFournisseursPageModule)
  },
  {
    path: 'resultat-net',
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN'] },
    loadChildren: () => import('./pages/resultat-net/resultat-net.module').then(m => m.ResultatNetPageModule)
  },
  {
    path: 'mobile-money',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/mobile-money/mobile-money.module').then(m => m.MobileMoneyPageModule)
  },
  {
    path: 'assistant-ia',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/assistant-ia/assistant-ia.module').then(m => m.AssistantIaPageModule)
  },
  {
    path: 'facture-design',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/facture-design/facture-design.module').then(m => m.FactureDesignPageModule)
  },
  {
    path: 'langue',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/langue/langue.module').then(m => m.LanguePageModule)
  },
  {
    path: 'promotions',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/promotions/promotions.module').then(m => m.PromotionsPageModule)
  },
  {
    path: 'commandes',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/commandes/commandes.module').then(m => m.CommandesPageModule)
  },
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'tabs'
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
