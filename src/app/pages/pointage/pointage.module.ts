import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { PointagePage } from './pointage.page';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild([{ path: '', component: PointagePage }])],
  declarations: [PointagePage]
})
export class PointagePageModule {}
