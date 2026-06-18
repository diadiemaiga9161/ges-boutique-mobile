import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { AssistantIaPageRoutingModule } from './assistant-ia-routing.module';
import { AssistantIaPage } from './assistant-ia.page';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, AssistantIaPageRoutingModule],
  declarations: [AssistantIaPage]
})
export class AssistantIaPageModule {}
