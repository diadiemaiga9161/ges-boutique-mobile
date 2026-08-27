import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { JournalAuditPageRoutingModule } from './journal-audit-routing.module';
import { JournalAuditPage } from './journal-audit.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, JournalAuditPageRoutingModule, TranslateModule],
  declarations: [JournalAuditPage]
})
export class JournalAuditPageModule {}
