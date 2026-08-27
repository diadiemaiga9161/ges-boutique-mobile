import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { SauvegardesPageRoutingModule } from './sauvegardes-routing.module';
import { SauvegardesPage } from './sauvegardes.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SauvegardesPageRoutingModule, TranslateModule],
  declarations: [SauvegardesPage]
})
export class SauvegardesPageModule {}
