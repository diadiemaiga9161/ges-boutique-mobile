import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PrimesProduitsPage } from './primes-produits.page';

const routes: Routes = [{ path: '', component: PrimesProduitsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PrimesProduitsPageRoutingModule {}
