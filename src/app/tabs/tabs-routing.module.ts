import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'caisse',
        data: { roles: ['ADMIN'] },
        loadChildren: () => import('../pages/caisse/caisse.module').then(m => m.CaissePageModule)
      },
      {
        path: 'sales',
        loadChildren: () => import('../pages/sales/sales.module').then(m => m.SalesPageModule)
      },
      {
        path: 'factures',
        loadChildren: () => import('../pages/factures/factures.module').then(m => m.FacturesPageModule)
      },
      {
        path: 'inventory',
        data: { roles: ['ADMIN'] },
        loadChildren: () => import('../pages/inventory/inventory.module').then(m => m.InventoryPageModule)
      },
      {
        path: 'products',
        loadChildren: () => import('../pages/products/products.module').then(m => m.ProductsPageModule)
      },
      {
        path: 'reports',
        data: { roles: ['ADMIN'] },
        loadChildren: () => import('../pages/reports/reports.module').then(m => m.ReportsPageModule)
      },
      {
        path: 'benefices',
        data: { roles: ['ADMIN'] },
        loadChildren: () => import('../pages/benefices/benefices.module').then(m => m.BeneficesPageModule)
      },
      {
        path: 'notifications',
        loadChildren: () => import('../pages/notifications/notifications.module').then(m => m.NotificationsPageModule)
      },
      {
        path: 'transferts',
        data: { roles: ['ADMIN'] },
        loadChildren: () => import('../pages/transferts/transferts.module').then(m => m.TransfertsPageModule)
      },
      {
        path: '',
        redirectTo: 'caisse',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsRoutingModule {}
