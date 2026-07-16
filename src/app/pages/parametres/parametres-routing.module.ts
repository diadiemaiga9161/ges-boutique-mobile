import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ParametresPage } from './parametres.page';

const routes: Routes = [{ path: '', component: ParametresPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ParametresPageRoutingModule {}
