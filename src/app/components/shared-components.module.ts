import { NgModule } from '@angular/core';

import { StatCardComponent } from './stat-card/stat-card.component';
import { ProductCardComponent } from './product-card/product-card.component';
import { StockBadgeComponent } from './stock-badge/stock-badge.component';
import { CreditBadgeComponent } from './credit-badge/credit-badge.component';
import { EmptyStateComponent } from './empty-state/empty-state.component';
import { SectionHeaderComponent } from './section-header/section-header.component';
import { QuickActionComponent } from './quick-action/quick-action.component';
import { BottomSheetComponent } from './bottom-sheet/bottom-sheet.component';
import { ConfirmSheetComponent } from './confirm-sheet/confirm-sheet.component';

/** Regroupe les composants partagés du design system (Phase 2) pour un
 *  import unique dans les modules de page (standalone: false) — même
 *  principe que OfflineStatusModule pour app-offline-status. Chaque
 *  composant listé ici est lui-même standalone (cf. convention déjà en
 *  place pour offline-status / pwa-install / tutoriel-vendeur) : ce module
 *  ne fait que les ré-exporter groupés. */
@NgModule({
  imports: [
    StatCardComponent,
    ProductCardComponent,
    StockBadgeComponent,
    CreditBadgeComponent,
    EmptyStateComponent,
    SectionHeaderComponent,
    QuickActionComponent,
    BottomSheetComponent,
    ConfirmSheetComponent
  ],
  exports: [
    StatCardComponent,
    ProductCardComponent,
    StockBadgeComponent,
    CreditBadgeComponent,
    EmptyStateComponent,
    SectionHeaderComponent,
    QuickActionComponent,
    BottomSheetComponent,
    ConfirmSheetComponent
  ]
})
export class SharedComponentsModule {}
