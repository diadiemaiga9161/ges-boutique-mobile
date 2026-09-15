import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TransfertsPageRoutingModule } from './transferts-routing.module';
import { TransfertsPage } from './transferts.page';
import { TranslateModule } from '@ngx-translate/core';
import { MontantInputDirective } from '../../directives/montant-input.directive';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TransfertsPageRoutingModule, TranslateModule, MontantInputDirective, SharedComponentsModule],
  declarations: [TransfertsPage]
})
export class TransfertsPageModule {}
