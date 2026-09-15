import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FournisseursPageRoutingModule } from './fournisseurs-routing.module';
import { FournisseursPage } from './fournisseurs.page';
import { TranslateModule } from '@ngx-translate/core';
import { MontantInputDirective } from '../../directives/montant-input.directive';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, FournisseursPageRoutingModule, TranslateModule, MontantInputDirective, SharedComponentsModule],
  declarations: [FournisseursPage]
})
export class FournisseursPageModule {}
