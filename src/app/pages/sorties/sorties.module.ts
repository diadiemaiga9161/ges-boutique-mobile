import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SortiesPageRoutingModule } from './sorties-routing.module';
import { SortiesPage } from './sorties.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SortiesPageRoutingModule, TranslateModule],
  declarations: [SortiesPage]
})
export class SortiesPageModule {}
