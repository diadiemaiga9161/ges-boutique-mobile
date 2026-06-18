import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BoutiqueSelectPage } from './boutique-select.page';
import { TranslateModule } from '@ngx-translate/core';

const routes: Routes = [
  { path: '', component: BoutiqueSelectPage }
];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [BoutiqueSelectPage]
})
export class BoutiqueSelectPageModule {}
