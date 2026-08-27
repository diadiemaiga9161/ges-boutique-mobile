import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BonusFournisseursPageRoutingModule } from './bonus-fournisseurs-routing.module';
import { BonusFournisseursPage } from './bonus-fournisseurs.page';
import { TranslateModule } from '@ngx-translate/core';
import { MontantInputDirective } from '../../directives/montant-input.directive';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, BonusFournisseursPageRoutingModule, TranslateModule, MontantInputDirective],
  declarations: [BonusFournisseursPage]
})
export class BonusFournisseursPageModule {}
