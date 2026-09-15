import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BoutiqueSettingsPageRoutingModule } from './boutique-settings-routing.module';
import { BoutiqueSettingsPage } from './boutique-settings.page';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BoutiqueSettingsPageRoutingModule, TranslateModule, SharedComponentsModule],
  declarations: [BoutiqueSettingsPage]
})
export class BoutiqueSettingsPageModule {}
