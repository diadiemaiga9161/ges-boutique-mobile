import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { ClassementVendeursPage } from './classement-vendeurs.page';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild([{ path: '', component: ClassementVendeursPage }])],
  declarations: [ClassementVendeursPage]
})
export class ClassementVendeursPageModule {}
