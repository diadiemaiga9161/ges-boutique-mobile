import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { FournisseursPageRoutingModule } from './fournisseurs-routing.module';
import { FournisseursPage } from './fournisseurs.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, FournisseursPageRoutingModule],
  declarations: [FournisseursPage]
})
export class FournisseursPageModule {}
