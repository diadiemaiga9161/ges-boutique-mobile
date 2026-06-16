import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ConfigTransfertsPage } from './config-transferts.page';
import { ConfigTransfertsRoutingModule } from './config-transferts-routing.module';

@NgModule({
  declarations: [ConfigTransfertsPage],
  imports: [CommonModule, FormsModule, IonicModule, ConfigTransfertsRoutingModule]
})
export class ConfigTransfertsPageModule {}
