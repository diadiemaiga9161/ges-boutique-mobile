import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from '../../components/shared-components.module';
import { ParametresHubPageRoutingModule } from './parametres-hub-routing.module';
import { ParametresHubPage } from './parametres-hub.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    TranslateModule,
    SharedComponentsModule,
    ParametresHubPageRoutingModule
  ],
  declarations: [ParametresHubPage]
})
export class ParametresHubPageModule {}
