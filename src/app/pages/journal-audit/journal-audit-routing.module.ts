import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { JournalAuditPage } from './journal-audit.page';

const routes: Routes = [{ path: '', component: JournalAuditPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class JournalAuditPageRoutingModule {}
