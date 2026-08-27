import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { SauvegardesPage } from './sauvegardes.page';

const routes: Routes = [{ path: '', component: SauvegardesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SauvegardesPageRoutingModule {}
