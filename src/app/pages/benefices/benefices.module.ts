import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BeneficesPageRoutingModule } from './benefices-routing.module';
import { BeneficesPage } from './benefices.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BeneficesPageRoutingModule],
  declarations: [BeneficesPage]
})
export class BeneficesPageModule {}
