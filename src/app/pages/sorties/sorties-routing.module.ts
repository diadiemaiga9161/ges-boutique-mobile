import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SortiesPage } from './sorties.page';

const routes: Routes = [{ path: '', component: SortiesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SortiesPageRoutingModule {}
