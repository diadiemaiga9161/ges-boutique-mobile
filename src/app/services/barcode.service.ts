import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BarcodeService {

  constructor(private alertCtrl: AlertController) {}

  async scan(): Promise<string | null> {
    if (!environment.isCapacitor) {
      return this.scanWeb();
    }

    try {
      const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: granted } = await BarcodeScanner.requestPermissions();
        if (granted !== 'granted') {
          await this.showError('Permission caméra refusée.');
          return null;
        }
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.QrCode,
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
        ]
      });

      return barcodes.length > 0 ? (barcodes[0].rawValue ?? null) : null;

    } catch (err: any) {
      if (err?.message?.includes('cancelled')) return null;
      await this.showError('Erreur scanner : ' + (err?.message || 'inconnue'));
      return null;
    }
  }

  private async scanWeb(): Promise<string | null> {
    const alert = await this.alertCtrl.create({
      header: 'Saisir le code-barres',
      inputs: [{ name: 'code', type: 'text', placeholder: 'Ex: 3017620422003' }],
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'OK', role: 'confirm' }
      ]
    });
    await alert.present();
    const { data, role } = await alert.onDidDismiss();
    if (role === 'confirm' && data?.values?.code) {
      return data.values.code.trim();
    }
    return null;
  }

  private async showError(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Erreur',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
