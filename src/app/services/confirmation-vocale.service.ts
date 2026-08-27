import { Injectable } from '@angular/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { construireAnnonceMontant } from './nombre-en-lettres';

const STORAGE_KEY = 'pref_annonce_vocale_vente';

/**
 * Confirmation vocale du montant total après une vente validée (flux
 * Caisse / Nouvelle vente uniquement — voir CartPage.submit()).
 *
 * ── Choix technique : @capacitor-community/text-to-speech ────────────────
 * Plutôt que d'utiliser `window.speechSynthesis` directement, on passe par
 * le plugin natif @capacitor-community/text-to-speech :
 * - Dans une WebView Capacitor packagée (APK/IPA), l'API Web Speech est
 *   connue pour être peu fiable : chargement asynchrone des voix
 *   (l'évènement `voiceschanged` ne se déclenche parfois jamais sur
 *   certains appareils Android), absence de voix françaises par défaut sur
 *   certains OEM, comportement inconsistant entre Android/iOS/navigateur.
 * - Le plugin s'appuie en natif sur le moteur TTS déjà installé sur le
 *   téléphone (`android.speech.tts.TextToSpeech` côté Android,
 *   `AVSpeechSynthesizer` côté iOS) : 100% hors-ligne, aucun service payant,
 *   comportement bien plus prévisible dans une app packagée.
 * - Il embarque malgré tout une implémentation web (basée sur
 *   `window.speechSynthesis`) utilisée automatiquement en mode navigateur
 *   (`ionic serve`), donc aucun code dupliqué n'est nécessaire ici pour le
 *   développement.
 *
 * ── Règle "fire and forget" ────────────────────────────────────────────
 * Cette fonctionnalité ne doit jamais bloquer ni faire échouer une vente.
 * Toute erreur (moteur TTS absent, voix française non installée, plugin
 * indisponible en navigateur non supporté...) est interceptée ici et ne
 * remonte jamais à l'appelant : en cas d'échec, la vente continue
 * normalement, silencieusement, sans aucune erreur visible pour le vendeur.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmationVocaleService {

  /** Activé par défaut : seule une désactivation explicite coupe la voix. */
  isActive(): boolean {
    return localStorage.getItem(STORAGE_KEY) !== 'false';
  }

  setActive(actif: boolean): void {
    localStorage.setItem(STORAGE_KEY, String(actif));
  }

  /**
   * Annonce vocalement le montant total d'une vente validée, uniquement si
   * le réglage utilisateur est activé. Ne retourne rien : à appeler juste
   * après le succès de l'enregistrement d'une vente, sans jamais attendre
   * (`await`) son résultat.
   */
  annoncerMontant(montant: number): void {
    if (!this.isActive()) return;

    try {
      const texte = construireAnnonceMontant(montant);
      TextToSpeech.speak({
        text: texte,
        lang: 'fr-FR',
        rate: 0.95,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      }).catch(err => {
        // Moteur TTS absent, voix fr-FR non installée, plugin non supporté...
        // Jamais bloquant : on journalise en silence et la vente continue.
        console.warn('[ConfirmationVocaleService] Annonce vocale impossible :', err);
      });
    } catch (err) {
      console.warn('[ConfirmationVocaleService] Erreur inattendue :', err);
    }
  }
}
