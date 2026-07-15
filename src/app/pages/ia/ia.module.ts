import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { IaPageRoutingModule } from './ia-routing.module';
import { IaPage } from './ia.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TranslateModule, IaPageRoutingModule],
  declarations: [IaPage]
})
export class IaPageModule {}
