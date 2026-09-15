import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HistoriqueVendeurPageRoutingModule } from './historique-vendeur-routing.module';
import { HistoriqueVendeurPage } from './historique-vendeur.page';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, HistoriqueVendeurPageRoutingModule, SharedComponentsModule],
  declarations: [HistoriqueVendeurPage]
})
export class HistoriqueVendeurPageModule {}
