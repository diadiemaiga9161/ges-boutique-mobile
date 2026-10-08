import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RolesPage } from './roles.page';

const routes: Routes = [{ path: '', component: RolesPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RolesPageRoutingModule {}
