import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { TransfertsPage } from './transferts.page';

const routes: Routes = [{ path: '', component: TransfertsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TransfertsPageRoutingModule {}
