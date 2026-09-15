import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ConfigTransfertsPage } from './config-transferts.page';
import { ConfigTransfertsRoutingModule } from './config-transferts-routing.module';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  declarations: [ConfigTransfertsPage],
  imports: [CommonModule, FormsModule, IonicModule, ConfigTransfertsRoutingModule, TranslateModule, SharedComponentsModule]
})
export class ConfigTransfertsPageModule {}
