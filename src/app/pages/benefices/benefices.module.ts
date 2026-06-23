import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BeneficesPageRoutingModule } from './benefices-routing.module';
import { BeneficesPage } from './benefices.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BeneficesPageRoutingModule, TranslateModule],
  declarations: [BeneficesPage]
})
export class BeneficesPageModule {}
