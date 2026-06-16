import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ResultatNetPageRoutingModule } from './resultat-net-routing.module';
import { ResultatNetPage } from './resultat-net.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ResultatNetPageRoutingModule],
  declarations: [ResultatNetPage]
})
export class ResultatNetPageModule {}
