import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RolesPageRoutingModule } from './roles-routing.module';
import { RolesPage } from './roles.page';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RolesPageRoutingModule, SharedComponentsModule],
  declarations: [RolesPage]
})
export class RolesPageModule {}
