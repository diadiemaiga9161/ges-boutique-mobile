import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { LanguePageRoutingModule } from './langue-routing.module';
import { LanguePage } from './langue.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, IonicModule, LanguePageRoutingModule, TranslateModule],
  declarations: [LanguePage]
})
export class LanguePageModule {}
