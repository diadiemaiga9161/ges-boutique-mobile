import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { CartPageRoutingModule } from './cart-routing.module';
import { CartPage } from './cart.page';
import { MontantInputDirective } from '../../directives/montant-input.directive';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    CartPageRoutingModule,
    MontantInputDirective,
    SharedComponentsModule
  ],
  declarations: [CartPage]
})
export class CartPageModule {}
