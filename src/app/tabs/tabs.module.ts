import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';
import { TabsPage } from './tabs.page';
import { TabsRoutingModule } from './tabs-routing.module';

@NgModule({
  declarations: [TabsPage],
  imports: [CommonModule, IonicModule, TabsRoutingModule, TranslateModule]
})
export class TabsPageModule {}
