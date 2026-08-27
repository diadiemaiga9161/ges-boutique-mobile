import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ExportDonneesPage } from './export-donnees.page';

const routes: Routes = [{ path: '', component: ExportDonneesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ExportDonneesPageRoutingModule {}
