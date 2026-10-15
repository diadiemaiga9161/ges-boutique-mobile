import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ClientsAbsentsPage } from './clients-absents.page';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild([{ path: '', component: ClientsAbsentsPage }])],
  declarations: [ClientsAbsentsPage]
})
export class ClientsAbsentsPageModule {}
