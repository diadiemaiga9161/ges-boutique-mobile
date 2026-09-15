import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

export type GlStatCardVariant = 'blue' | 'green' | 'orange' | 'red' | 'slate';

/** Tuile KPI générique (icône + label + valeur) — reprend le visuel de
 *  .kpi-tile (home.page.scss) déjà dupliqué en variantes locales dans
 *  home/caisse/depenses/fournisseurs (.kpi-tile, .stat-card). Destinée à
 *  remplacer ces blocs dans une phase ultérieure d'intégration. */
@Component({
  selector: 'gl-stat-card',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './stat-card.component.html',
  styleUrls: ['./stat-card.component.scss']
})
export class StatCardComponent {
  @Input() icon = '';
  @Input() label = '';
  @Input() value = '';
  @Input() sub?: string;
  @Input() variant: GlStatCardVariant = 'blue';
  @Input() tappable = false;

  @Output() cardClick = new EventEmitter<void>();

  onClick(): void {
    if (this.tappable) this.cardClick.emit();
  }
}
