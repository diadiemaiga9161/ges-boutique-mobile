import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DepensesPageRoutingModule } from './depenses-routing.module';
import { DepensesPage } from './depenses.page';
import { TranslateModule } from '@ngx-translate/core';
import { MontantInputDirective } from '../../directives/montant-input.directive';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, DepensesPageRoutingModule, TranslateModule, MontantInputDirective, SharedComponentsModule],
  declarations: [DepensesPage]
})
export class DepensesPageModule {}
