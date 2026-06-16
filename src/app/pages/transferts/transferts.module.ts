import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TransfertsPageRoutingModule } from './transferts-routing.module';
import { TransfertsPage } from './transferts.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TransfertsPageRoutingModule],
  declarations: [TransfertsPage]
})
export class TransfertsPageModule {}
