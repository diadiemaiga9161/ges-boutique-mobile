import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { OfflineStatusComponent } from './offline-status.component';

@NgModule({
  declarations: [OfflineStatusComponent],
  imports: [CommonModule, IonicModule],
  exports: [OfflineStatusComponent]
})
export class OfflineStatusModule {}
