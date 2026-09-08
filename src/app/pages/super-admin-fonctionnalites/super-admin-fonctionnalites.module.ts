import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SuperAdminFonctionnalitesPageRoutingModule } from './super-admin-fonctionnalites-routing.module';
import { SuperAdminFonctionnalitesPage } from './super-admin-fonctionnalites.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, SuperAdminFonctionnalitesPageRoutingModule],
  declarations: [SuperAdminFonctionnalitesPage]
})
export class SuperAdminFonctionnalitesPageModule {}
