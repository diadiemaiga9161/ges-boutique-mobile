import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ComptagePage } from './comptage.page';

const routes: Routes = [{ path: '', component: ComptagePage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ComptagePageRoutingModule {}
