import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { BeneficesPage } from './benefices.page';

const routes: Routes = [{ path: '', component: BeneficesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class BeneficesPageRoutingModule {}
