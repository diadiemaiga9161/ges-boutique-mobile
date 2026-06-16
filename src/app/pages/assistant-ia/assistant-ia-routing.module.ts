import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AssistantIaPage } from './assistant-ia.page';

const routes: Routes = [{ path: '', component: AssistantIaPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AssistantIaPageRoutingModule {}
