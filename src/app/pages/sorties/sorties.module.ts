import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SortiesPageRoutingModule } from './sorties-routing.module';
import { SortiesPage } from './sorties.page';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SortiesPageRoutingModule, TranslateModule, SharedComponentsModule],
  declarations: [SortiesPage]
})
export class SortiesPageModule {}
