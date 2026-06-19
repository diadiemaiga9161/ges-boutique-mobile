import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule, Routes } from '@angular/router';
import { FactureDesignPage } from './facture-design.page';

const routes: Routes = [{ path: '', component: FactureDesignPage }];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TranslateModule, RouterModule.forChild(routes)],
  declarations: [FactureDesignPage]
})
export class FactureDesignPageModule {}
