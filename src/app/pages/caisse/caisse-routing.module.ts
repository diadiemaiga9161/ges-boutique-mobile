import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CaissePage } from './caisse.page';

const routes: Routes = [{ path: '', component: CaissePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CaissePageRoutingModule {}
