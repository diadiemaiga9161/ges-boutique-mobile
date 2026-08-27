import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { ExportDonneesPageRoutingModule } from './export-donnees-routing.module';
import { ExportDonneesPage } from './export-donnees.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ExportDonneesPageRoutingModule, TranslateModule],
  declarations: [ExportDonneesPage]
})
export class ExportDonneesPageModule {}
