import { Injectable } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BarcodeService {

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  async scan(): Promise<string | null> {
    if (!environment.isCapacitor) {
      return this.scanWeb();
    }

    try {
      const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');

      // Vérifier si MLKit est supporté sur cet appareil
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) {
        return this.scanWeb();
      }

      // Vérifier / installer le module Google Barcode Scanner
      try {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await this.showToast('Installation du module scanner…', 'warning');
          await BarcodeScanner.installGoogleBarcodeScannerModule();
          await this.showToast('Module installé. Réessayez le scan.', 'success');
          return null;
        }
      } catch {
        // Ancienne version du plugin — pas de module séparé, on continue
      }

      // Demander permission caméra
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: granted } = await BarcodeScanner.requestPermissions();
        if (granted !== 'granted') {
          await this.showToast('Permission caméra refusée.', 'danger');
          return null;
        }
      }

      // Lancer le scan natif
      const { barcodes } = await BarcodeScanner.scan({
        formats: [
          BarcodeFormat.QrCode,
          BarcodeFormat.Ean13,
          BarcodeFormat.Ean8,
          BarcodeFormat.Code128,
          BarcodeFormat.Code39,
          BarcodeFormat.UpcA,
          BarcodeFormat.UpcE,
          BarcodeFormat.DataMatrix,
        ]
      });

      return barcodes.length > 0 ? (barcodes[0].rawValue ?? null) : null;

    } catch (err: any) {
      const msg: string = err?.message || '';
      if (msg.toLowerCase().includes('cancel') || msg.toLowerCase().includes('user')) {
        return null;
      }
      // Scan natif impossible → saisie manuelle automatique
      await this.showToast('Scanner indisponible. Saisie manuelle activée.', 'warning');
      return this.scanWeb();
    }
  }

  private async scanWeb(): Promise<string | null> {
    const alert = await this.alertCtrl.create({
      header: 'Code-barres',
      subHeader: 'Saisir manuellement',
      inputs: [{ name: 'code', type: 'text', placeholder: 'Ex: 3017620422003', attributes: { inputmode: 'numeric' } }],
      buttons: [
        { text: 'Annuler', role: 'cancel', cssClass: 'alert-btn-danger' },
        { text: 'Valider', role: 'confirm', cssClass: 'alert-btn-primary' }
      ]
    });
    await alert.present();
    const { data, role } = await alert.onDidDismiss();
    if (role === 'confirm' && data?.values?.code?.trim()) {
      return data.values.code.trim();
    }
    return null;
  }

  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top',
      icon: color === 'danger' ? 'close-circle' : color === 'warning' ? 'warning' : 'checkmark-circle'
    });
    await toast.present();
  }
}
