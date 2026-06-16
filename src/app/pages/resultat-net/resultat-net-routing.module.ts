import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ResultatNetPage } from './resultat-net.page';

const routes: Routes = [{ path: '', component: ResultatNetPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ResultatNetPageRoutingModule {}
