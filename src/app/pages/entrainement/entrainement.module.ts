import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { EntrainementPage } from './entrainement.page';

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild([{ path: '', component: EntrainementPage }])],
  declarations: [EntrainementPage]
})
export class EntrainementPageModule {}
