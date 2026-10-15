import { Injectable, NgZone } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Écoute du micro pour la vente à la voix, avec la reconnaissance vocale du navigateur
 * (Chrome sur Android : gratuite, en français, il faut internet). Dans l'appli Android
 * installée (APK), la WebView ne la fournit pas : le bouton micro n'y est pas affiché.
 */
@Injectable({ providedIn: 'root' })
export class VenteVoixService {
  private reco: any = null;

  constructor(private zone: NgZone) {}

  private get constructeur(): any {
    const w = window as any;
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
  }

  /** true si ce téléphone/navigateur sait transformer la voix en texte. */
  disponible(): boolean {
    return !!this.constructeur && !Capacitor.isNativePlatform();
  }

  /**
   * Écoute une phrase. `enCours` reçoit le texte au fur et à mesure (affichage) ; la
   * promesse rend les versions proposées par la reconnaissance, la plus probable d'abord.
   */
  ecouter(enCours?: (texte: string) => void): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const Ctor = this.constructeur;
      if (!Ctor) { reject(new Error('Reconnaissance vocale indisponible sur ce téléphone.')); return; }
      this.arreter();
      const reco = new Ctor();
      this.reco = reco;
      reco.lang = 'fr-FR';
      reco.interimResults = true;
      reco.maxAlternatives = 3;
      reco.continuous = false;
      let versions: string[] = [];
      reco.onresult = (e: any) => {
        const res = e.results[e.results.length - 1];
        const texte = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(' ');
        this.zone.run(() => enCours?.(texte));
        if (res.isFinal) {
          versions = Array.from(res as ArrayLike<any>).map((a: any) => String(a.transcript || '').trim()).filter(Boolean);
          // Plusieurs morceaux finaux (pauses) : la première version garde toute la phrase.
          if (e.results.length > 1) versions = [texte.trim(), ...versions];
        }
      };
      reco.onerror = (e: any) => {
        this.reco = null;
        this.zone.run(() => reject(new Error(this.messageErreur(e?.error))));
      };
      reco.onend = () => {
        this.reco = null;
        this.zone.run(() => versions.length ? resolve(versions) : reject(new Error(this.messageErreur('no-speech'))));
      };
      try {
        reco.start();
      } catch {
        this.reco = null;
        reject(new Error('Le micro est déjà utilisé. Réessayez.'));
      }
    });
  }

  /** Fin de l'écoute : la phrase déjà entendue est gardée. */
  terminer(): void {
    try { this.reco?.stop(); } catch { /* déjà arrêtée */ }
  }

  /** Abandon de l'écoute, sans résultat. */
  arreter(): void {
    try { this.reco?.abort(); } catch { /* déjà arrêtée */ }
    this.reco = null;
  }

  private messageErreur(code?: string): string {
    switch (code) {
      case 'not-allowed':
      case 'service-not-allowed':
        return 'Autorisez le micro pour cette application (réglages du navigateur).';
      case 'no-speech':
        return 'Je n\'ai rien entendu. Appuyez sur le micro et parlez.';
      case 'audio-capture':
        return 'Micro introuvable sur ce téléphone.';
      case 'network':
        return 'Pas de connexion internet : la voix a besoin d\'internet.';
      case 'aborted':
        return 'Écoute arrêtée.';
      default:
        return 'La voix n\'a pas été comprise. Réessayez ou tapez le nom.';
    }
  }
}
