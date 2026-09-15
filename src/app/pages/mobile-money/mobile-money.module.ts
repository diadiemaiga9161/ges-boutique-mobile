import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MobileMoneyPageRoutingModule } from './mobile-money-routing.module';
import { MobileMoneyPage } from './mobile-money.page';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, MobileMoneyPageRoutingModule, TranslateModule, SharedComponentsModule],
  declarations: [MobileMoneyPage]
})
export class MobileMoneyPageModule {}
