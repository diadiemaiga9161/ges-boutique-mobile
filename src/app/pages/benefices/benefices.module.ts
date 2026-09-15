import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BeneficesPageRoutingModule } from './benefices-routing.module';
import { BeneficesPage } from './benefices.page';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BeneficesPageRoutingModule, TranslateModule, SharedComponentsModule],
  declarations: [BeneficesPage]
})
export class BeneficesPageModule {}
