import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HttpClientModule } from '@angular/common/http';
import { TranslateModule } from '@ngx-translate/core';
import { FacturesPageRoutingModule } from './factures-routing.module';
import { FacturesPage } from './factures.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, HttpClientModule, TranslateModule, FacturesPageRoutingModule],
  declarations: [FacturesPage]
})
export class FacturesPageModule {}
