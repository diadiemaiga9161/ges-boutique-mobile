import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { CartPageRoutingModule } from './cart-routing.module';
import { CartPage } from './cart.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TranslateModule,
    CartPageRoutingModule
  ],
  declarations: [CartPage]
})
export class CartPageModule {}
