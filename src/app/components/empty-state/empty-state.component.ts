import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

/** État vide générique — reprend le visuel de .empty-v2 (global.scss),
 *  déjà utilisé tel quel dans products.page.html. */
@Component({
  selector: 'gl-empty-state',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss']
})
export class EmptyStateComponent {
  @Input() icon = 'file-tray-outline';
  @Input() title = '';
  @Input() message = '';
  @Input() ctaLabel?: string;

  @Output() ctaClick = new EventEmitter<void>();
}
