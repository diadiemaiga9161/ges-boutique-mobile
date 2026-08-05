import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { HistoriqueVendeurPage } from './historique-vendeur.page';

const routes: Routes = [{ path: '', component: HistoriqueVendeurPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HistoriqueVendeurPageRoutingModule {}
