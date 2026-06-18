import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FacturesPageRoutingModule } from './factures-routing.module';
import { FacturesPage } from './factures.page';
import { TranslateModule } from '@ngx-translate/core';
@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, FacturesPageRoutingModule],
  declarations: [FacturesPage]
})
export class FacturesPageModule {}
