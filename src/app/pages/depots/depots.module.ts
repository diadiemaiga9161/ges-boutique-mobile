import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DepotsPageRoutingModule } from './depots-routing.module';
import { DepotsPage } from './depots.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, DepotsPageRoutingModule],
  declarations: [DepotsPage]
})
export class DepotsPageModule {}
