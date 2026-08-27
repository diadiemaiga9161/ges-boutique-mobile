import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ResourcesPageRoutingModule } from './resources-routing.module';
import { ResourcesPage } from './resources.page';
import { TranslateModule } from '@ngx-translate/core';
import { MontantInputDirective } from '../../directives/montant-input.directive';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ResourcesPageRoutingModule, TranslateModule, MontantInputDirective],
  declarations: [ResourcesPage]
})
export class ResourcesPageModule {}
