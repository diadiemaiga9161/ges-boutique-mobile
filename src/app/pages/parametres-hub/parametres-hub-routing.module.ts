import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ParametresHubPage } from './parametres-hub.page';

const routes: Routes = [{ path: '', component: ParametresHubPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ParametresHubPageRoutingModule {}
