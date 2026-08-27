import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ClientsPageRoutingModule } from './clients-routing.module';
import { ClientsPage } from './clients.page';
import { TranslateModule } from '@ngx-translate/core';
import { MontantInputDirective } from '../../directives/montant-input.directive';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ClientsPageRoutingModule, TranslateModule, MontantInputDirective],
  declarations: [ClientsPage]
})
export class ClientsPageModule {}
