import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MobileMoneyPageRoutingModule } from './mobile-money-routing.module';
import { MobileMoneyPage } from './mobile-money.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, MobileMoneyPageRoutingModule],
  declarations: [MobileMoneyPage]
})
export class MobileMoneyPageModule {}
