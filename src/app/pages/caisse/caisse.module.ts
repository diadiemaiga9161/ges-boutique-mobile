import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CaissePageRoutingModule } from './caisse-routing.module';
import { CaissePage } from './caisse.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CaissePageRoutingModule, TranslateModule],
  declarations: [CaissePage]
})
export class CaissePageModule {}
