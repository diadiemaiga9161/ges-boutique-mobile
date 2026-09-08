import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SuperAdminFonctionnalitesPage } from './super-admin-fonctionnalites.page';

const routes: Routes = [{ path: '', component: SuperAdminFonctionnalitesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SuperAdminFonctionnalitesPageRoutingModule {}
