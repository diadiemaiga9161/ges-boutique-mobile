import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BonusFournisseursPageRoutingModule } from './bonus-fournisseurs-routing.module';
import { BonusFournisseursPage } from './bonus-fournisseurs.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BonusFournisseursPageRoutingModule, TranslateModule],
  declarations: [BonusFournisseursPage]
})
export class BonusFournisseursPageModule {}
