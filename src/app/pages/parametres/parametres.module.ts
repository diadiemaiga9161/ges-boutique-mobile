import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ParametresPageRoutingModule } from './parametres-routing.module';
import { ParametresPage } from './parametres.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ParametresPageRoutingModule, TranslateModule],
  declarations: [ParametresPage]
})
export class ParametresPageModule {}
