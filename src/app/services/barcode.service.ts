import { Injectable } from '@angular/core';
import { AlertController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class BarcodeService {

  constructor(private alertCtrl: AlertController) {}

  async scan(): Promise<string | null> {
    // Essayer d'abord le scan caméra ZXing (fonctionne dans WebView et navigateur)
    const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    if (supported) {
      const result = await this.scanAvecCamera();
      if (result !== undefined) return result; // null = annulé, string = code trouvé
    }
    // Fallback : saisie manuelle
    return this.scanManuel();
  }

  private scanAvecCamera(): Promise<string | null | undefined> {
    return new Promise(async (resolve) => {
      // Créer l'overlay plein écran
      const overlay = document.createElement('div');
      overlay.id = 'zxing-overlay';
      overlay.innerHTML = `
        <style>
          #zxing-overlay {
            position: fixed; inset: 0; background: #000;
            z-index: 999999; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
          }
          #zxing-video {
            position: absolute; inset: 0;
            width: 100%; height: 100%; object-fit: cover;
          }
          .zx-ui {
            position: relative; z-index: 1;
            display: flex; flex-direction: column; align-items: center;
          }
          .zx-frame {
            width: 260px; height: 260px;
            border: 3px solid #1a56db; border-radius: 18px;
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.65);
            position: relative; overflow: hidden;
          }
          .zx-line {
            position: absolute; left: 10px; right: 10px; height: 2px;
            background: linear-gradient(90deg, transparent, #1a56db, transparent);
            animation: zxscan 2s ease-in-out infinite;
            top: 50%;
          }
          @keyframes zxscan {
            0%   { top: 15%; }
            50%  { top: 80%; }
            100% { top: 15%; }
          }
          .zx-corner {
            position: absolute; width: 24px; height: 24px;
            border-color: #fff; border-style: solid; border-width: 0;
          }
          .zx-corner.tl { top: 0; left: 0; border-top-width: 3px; border-left-width: 3px; border-radius: 4px 0 0 0; }
          .zx-corner.tr { top: 0; right: 0; border-top-width: 3px; border-right-width: 3px; border-radius: 0 4px 0 0; }
          .zx-corner.bl { bottom: 0; left: 0; border-bottom-width: 3px; border-left-width: 3px; border-radius: 0 0 0 4px; }
          .zx-corner.br { bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px; border-radius: 0 0 4px 0; }
          .zx-label { color: #fff; margin: 20px 0 6px; font-size: 15px; font-weight: 500; }
          .zx-sub   { color: rgba(255,255,255,0.5); font-size: 12px; margin: 0 0 24px; }
          .zx-cancel {
            background: rgba(255,255,255,0.12); color: #fff;
            border: 1px solid rgba(255,255,255,0.25); border-radius: 50px;
            padding: 12px 40px; font-size: 15px; cursor: pointer;
          }
          .zx-manual {
            background: transparent; color: rgba(255,255,255,0.45);
            border: none; font-size: 12px; margin-top: 12px; cursor: pointer;
            text-decoration: underline;
          }
        </style>
        <video id="zxing-video" autoplay playsinline muted></video>
        <div class="zx-ui">
          <div class="zx-frame">
            <div class="zx-line"></div>
            <div class="zx-corner tl"></div>
            <div class="zx-corner tr"></div>
            <div class="zx-corner bl"></div>
            <div class="zx-corner br"></div>
          </div>
          <p class="zx-label">Scanner un code-barres ou QR</p>
          <p class="zx-sub">Maintenir l'appareil stable face au code</p>
          <button class="zx-cancel" id="zx-btn-cancel">Annuler</button>
          <button class="zx-manual" id="zx-btn-manual">Saisie manuelle</button>
        </div>
      `;
      document.body.appendChild(overlay);

      const video = document.getElementById('zxing-video') as HTMLVideoElement;
      let controls: any = null;
      let done = false;
      let scanTimer: any = null;

      const cleanup = () => {
        done = true;
        if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
        try { controls?.stop(); } catch {}
        overlay.remove();
      };

      document.getElementById('zx-btn-cancel')!.addEventListener('click', () => {
        cleanup(); resolve(null);
      });
      document.getElementById('zx-btn-manual')!.addEventListener('click', () => {
        cleanup(); resolve(undefined); // undefined = passer à saisie manuelle
      });

      try {
        // Ouvrir la caméra arrière avec autofocus continu
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } as any
        });
        video.srcObject = stream;
        controls = { stop: () => stream.getTracks().forEach((t: MediaStreamTrack) => t.stop()) };

        // Activer l'autofocus continu si supporté (Android Chrome/WebView)
        try {
          const track = stream.getVideoTracks()[0];
          await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as any] });
        } catch { /* non supporté sur iOS/certains appareils — ignoré */ }

        await new Promise<void>(r => {
          video.onloadedmetadata = () => { video.play(); r(); };
        });

        // Canvas pour extraire les frames et les envoyer à ZXing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();

        // Scan toutes les 200ms — laisse le temps à l'autofocus entre chaque frame
        scanTimer = setInterval(() => {
          if (done) return;
          if (video.readyState < 2 || video.videoWidth === 0) return;
          canvas.width  = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          try {
            const result = reader.decodeFromCanvas(canvas);
            if (result && !done) {
              cleanup();
              resolve(result.getText());
            }
          } catch { /* pas de code détecté sur ce frame */ }
        }, 200);

      } catch {
        cleanup();
        resolve(undefined); // caméra inaccessible → saisie manuelle
      }
    });
  }

  private async scanManuel(): Promise<string | null> {
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
}
