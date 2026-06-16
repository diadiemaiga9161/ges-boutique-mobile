import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfigTransfertsPage } from './config-transferts.page';

const routes: Routes = [{ path: '', component: ConfigTransfertsPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConfigTransfertsRoutingModule {}
