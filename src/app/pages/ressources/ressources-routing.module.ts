import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RessourcesPage } from './ressources.page';

const routes: Routes = [{ path: '', component: RessourcesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RessourcesPageRoutingModule {}
