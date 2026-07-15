import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { IaPage } from './ia.page';

const routes: Routes = [{ path: '', component: IaPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IaPageRoutingModule {}
