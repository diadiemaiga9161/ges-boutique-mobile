import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MesPrimesPageRoutingModule } from './mes-primes-routing.module';
import { MesPrimesPage } from './mes-primes.page';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, MesPrimesPageRoutingModule, SharedComponentsModule],
  declarations: [MesPrimesPage]
})
export class MesPrimesPageModule {}
