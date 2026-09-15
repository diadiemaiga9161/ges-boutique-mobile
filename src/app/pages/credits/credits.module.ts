import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CreditsPageRoutingModule } from './credits-routing.module';
import { CreditsPage } from './credits.page';
import { TranslateModule } from '@ngx-translate/core';
import { MontantInputDirective } from '../../directives/montant-input.directive';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, CreditsPageRoutingModule, TranslateModule, MontantInputDirective, SharedComponentsModule],
  declarations: [CreditsPage]
})
export class CreditsPageModule {}
