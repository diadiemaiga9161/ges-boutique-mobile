import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

/** Titre de section avec action optionnelle à droite — reprend le visuel de
 *  .section-header (global.scss), étendu avec un lien d'action (ex: "Voir
 *  tout", déjà présent en dur dans clients.page.html). */
@Component({
  selector: 'gl-section-header',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './section-header.component.html',
  styleUrls: ['./section-header.component.scss']
})
export class SectionHeaderComponent {
  @Input() title = '';
  @Input() actionLabel?: string;

  @Output() actionClick = new EventEmitter<void>();
}
