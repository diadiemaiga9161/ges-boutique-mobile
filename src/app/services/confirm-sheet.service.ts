import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BottomSheetService } from './bottom-sheet.service';
import { ConfirmSheetComponent } from '../components/confirm-sheet/confirm-sheet.component';

export interface ConfirmSheetOptions {
  icon?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

/** Confirmation tactile pour actions sensibles (suppression, etc.) —
 *  alternative à `AlertController.create` nu (cf. les nombreux
 *  `alertCtrl.create({ header, message, buttons: [...] })` déjà présents
 *  dans les pages, ex. products.page.ts#confirmDelete). S'appuie sur
 *  BottomSheetService pour ouvrir <gl-confirm-sheet>. */
@Injectable({ providedIn: 'root' })
export class ConfirmSheetService {

  constructor(
    private bottomSheet: BottomSheetService,
    private translate: TranslateService
  ) {}

  async confirm(options: ConfirmSheetOptions): Promise<boolean> {
    const result = await this.bottomSheet.open<boolean>(
      ConfirmSheetComponent,
      {
        icon: options.icon || (options.danger ? 'warning-outline' : 'help-circle-outline'),
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || this.translate.instant('COMMON.CONFIRM'),
        cancelLabel: options.cancelLabel || this.translate.instant('COMMON.CANCEL'),
        danger: !!options.danger
      },
      [0, 0.5]
    );
    return !!result;
  }
}
