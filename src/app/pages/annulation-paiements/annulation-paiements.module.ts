import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { AnnulationPaiementsPageRoutingModule } from './annulation-paiements-routing.module';
import { AnnulationPaiementsPage } from './annulation-paiements.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, AnnulationPaiementsPageRoutingModule, TranslateModule],
  declarations: [AnnulationPaiementsPage]
})
export class AnnulationPaiementsPageModule {}
