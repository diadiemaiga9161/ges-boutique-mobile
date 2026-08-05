import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AnnulationPaiementsPage } from './annulation-paiements.page';

const routes: Routes = [{ path: '', component: AnnulationPaiementsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AnnulationPaiementsPageRoutingModule {}
