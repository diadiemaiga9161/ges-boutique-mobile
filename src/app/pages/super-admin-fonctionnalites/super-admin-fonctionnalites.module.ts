import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SuperAdminFonctionnalitesPageRoutingModule } from './super-admin-fonctionnalites-routing.module';
import { SuperAdminFonctionnalitesPage } from './super-admin-fonctionnalites.page';
import { SharedComponentsModule } from '../../components/shared-components.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SuperAdminFonctionnalitesPageRoutingModule, SharedComponentsModule],
  declarations: [SuperAdminFonctionnalitesPage]
})
export class SuperAdminFonctionnalitesPageModule {}
