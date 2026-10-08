import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ComptagePageRoutingModule } from './comptage-routing.module';
import { ComptagePage } from './comptage.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ComptagePageRoutingModule],
  declarations: [ComptagePage]
})
export class ComptagePageModule {}
