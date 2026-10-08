import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PrimesProduitsPageRoutingModule } from './primes-produits-routing.module';
import { PrimesProduitsPage } from './primes-produits.page';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PrimesProduitsPageRoutingModule, SharedComponentsModule],
  declarations: [PrimesProduitsPage]
})
export class PrimesProduitsPageModule {}
