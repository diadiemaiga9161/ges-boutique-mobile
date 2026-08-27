import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SalesPageRoutingModule } from './sales-routing.module';
import { SalesPage } from './sales.page';
import { TranslateModule } from '@ngx-translate/core';
import { MontantInputDirective } from '../../directives/montant-input.directive';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SalesPageRoutingModule, TranslateModule, MontantInputDirective],
  declarations: [SalesPage]
})
export class SalesPageModule {}
