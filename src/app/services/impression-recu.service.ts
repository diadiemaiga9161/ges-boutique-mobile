import { Injectable } from '@angular/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial, BluetoothDevice } from '@e-is/capacitor-bluetooth-serial';
import { BoutiqueInfo } from './boutique.service';
import { VenteMap, VenteService } from './vente.service';

/** Imprimante Bluetooth thermique mémorisée localement (pas de gestion d'appairage dans
 *  l'app — l'appairage initial se fait dans les réglages Bluetooth du téléphone). */
export interface ImprimanteEnregistree {
  address: string;
  name: string;
  /** Largeur du papier en nombre de caractères par ligne (police standard) : 32 = 58mm, 48 = 80mm. */
  largeurColonnes: 32 | 48;
}

const STORAGE_KEY = 'imprimante_thermique';
const LARGEUR_PAR_DEFAUT: 32 | 48 = 32;

// Commandes ESC/POS de base (voir norme Epson ESC/POS, largement clonée par les
// imprimantes thermiques bon marché vendues en Afrique).
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

/**
 * Impression de reçu de vente sur imprimante thermique Bluetooth classique (SPP), au format
 * ESC/POS. Utilise @e-is/capacitor-bluetooth-serial (Bluetooth Classic/RFCOMM — PAS du BLE),
 * seul plugin actuellement maintenu identifié qui expose du Bluetooth série générique
 * compatible Capacitor pour ce cas d'usage (voir choix documenté dans le rapport de tâche).
 *
 * IMPORTANT — non vérifié sur imprimante physique : toute cette intégration a été écrite et
 * compilée, mais jamais testée avec un vrai périphérique (aucune imprimante disponible côté
 * développement). À valider par un utilisateur final avant diffusion large.
 *
 * Cette fonctionnalité est entièrement optionnelle et ne doit jamais bloquer le flux de vente :
 * toutes les erreurs sont interceptées et affichées en toast/alerte, jamais relancées vers
 * l'écran appelant.
 */
@Injectable({ providedIn: 'root' })
export class ImpressionRecuService {

  constructor(
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private translate: TranslateService,
    private venteService: VenteService,
  ) {}

  /** true seulement sur l'application Android installée sur le téléphone — le plugin
   *  Bluetooth Classic utilisé ne fonctionne ni dans un navigateur/PWA ni sur iOS
   *  (non implémenté côté plugin, voir son README). */
  disponible(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  }

  // ==================== PERSISTANCE DU CHOIX D'IMPRIMANTE ====================
  // Même pattern que BoutiqueConfigService : Preferences Capacitor si disponible,
  // repli sur localStorage sinon (déjà utilisé ainsi dans le projet).

  async getImprimanteEnregistree(): Promise<ImprimanteEnregistree | null> {
    let raw: string | null = null;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      raw = (await Preferences.get({ key: STORAGE_KEY })).value;
    } catch {
      raw = localStorage.getItem(STORAGE_KEY);
    }
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ImprimanteEnregistree;
    } catch {
      return null;
    }
  }

  private async sauvegarderImprimante(imp: ImprimanteEnregistree): Promise<void> {
    const raw = JSON.stringify(imp);
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: STORAGE_KEY, value: raw });
    } catch {
      localStorage.setItem(STORAGE_KEY, raw);
    }
  }

  async oublierImprimante(): Promise<void> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: STORAGE_KEY });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // ==================== POINT D'ENTRÉE PRINCIPAL ====================

  /** Imprime le reçu d'une vente. Ne lève jamais d'exception : toute erreur est affichée
   *  en toast et la fonction se termine simplement, sans jamais perturber l'écran appelant. */
  async imprimerRecuVente(vente: VenteMap, boutique: BoutiqueInfo): Promise<void> {
    if (!this.disponible()) {
      await this.toast(this.translate.instant('IMPRESSION.NOT_SUPPORTED'), 'warning');
      return;
    }

    try {
      let imprimante = await this.getImprimanteEnregistree();
      if (!imprimante) {
        imprimante = await this.choisirImprimante();
        if (!imprimante) return; // annulé par l'utilisateur, rien à afficher de plus
      }

      await this.connecterEtImprimer(imprimante, vente, boutique);
    } catch (e: any) {
      await this.toast(this.messageErreur(e), 'danger');
    }
  }

  /** Force une nouvelle sélection d'imprimante (bouton "Changer d'imprimante"). */
  async changerImprimante(): Promise<void> {
    if (!this.disponible()) {
      await this.toast(this.translate.instant('IMPRESSION.NOT_SUPPORTED'), 'warning');
      return;
    }
    try {
      await this.choisirImprimante();
    } catch (e: any) {
      await this.toast(this.messageErreur(e), 'danger');
    }
  }

  // ==================== RECHERCHE / SÉLECTION ====================

  private async choisirImprimante(): Promise<ImprimanteEnregistree | null> {
    const etat = await BluetoothSerial.isEnabled().catch(() => ({ enabled: false }));
    if (!etat.enabled) {
      const active = await BluetoothSerial.enable().catch(() => ({ enabled: false }));
      if (!active.enabled) {
        await this.toast(this.translate.instant('IMPRESSION.BLUETOOTH_DISABLED'), 'danger');
        return null;
      }
    }

    const loading = await this.loadingCtrl.create({ message: this.translate.instant('IMPRESSION.SEARCHING') });
    await loading.present();
    let devices: BluetoothDevice[] = [];
    try {
      const result = await BluetoothSerial.scan();
      devices = (result.devices || []).filter(d => !!d?.name && !!d?.address);
    } finally {
      await loading.dismiss().catch(() => {});
    }

    if (!devices.length) {
      await this.toast(this.translate.instant('IMPRESSION.NO_PRINTER_FOUND'), 'warning');
      return null;
    }

    return this.presenterChoixImprimante(devices);
  }

  private presenterChoixImprimante(devices: BluetoothDevice[]): Promise<ImprimanteEnregistree | null> {
    return new Promise(resolve => {
      let done = false;
      const finish = (value: ImprimanteEnregistree | null) => {
        if (done) return;
        done = true;
        resolve(value);
      };

      this.alertCtrl.create({
        header: this.translate.instant('IMPRESSION.SELECT_PRINTER_TITLE'),
        message: this.translate.instant('IMPRESSION.SELECT_PRINTER_MESSAGE'),
        inputs: devices.map((d, i) => ({
          type: 'radio' as const,
          label: `${d.name} (${d.address})`,
          value: i,
          checked: i === 0,
        })),
        buttons: [
          { text: this.translate.instant('COMMON.CANCEL'), role: 'cancel', handler: () => finish(null) },
          {
            text: this.translate.instant('COMMON.CONFIRM'),
            handler: (index: number) => {
              const d = devices[index];
              if (!d) { finish(null); return; }
              const imp: ImprimanteEnregistree = { address: d.address, name: d.name || d.address, largeurColonnes: LARGEUR_PAR_DEFAUT };
              this.sauvegarderImprimante(imp).finally(() => finish(imp));
            }
          }
        ]
      }).then(async alert => {
        alert.onDidDismiss().then(() => finish(null));
        await alert.present();
      });
    });
  }

  // ==================== CONNEXION + ENVOI ====================

  private async connecterEtImprimer(imp: ImprimanteEnregistree, vente: VenteMap, boutique: BoutiqueInfo): Promise<void> {
    const loading = await this.loadingCtrl.create({ message: this.translate.instant('IMPRESSION.CONNECTING') });
    await loading.present();
    try {
      const deja = await BluetoothSerial.isConnected({ address: imp.address }).catch(() => ({ connected: false }));
      if (!deja.connected) {
        await this.connecterAvecRepli(imp.address);
      }
    } finally {
      await loading.dismiss().catch(() => {});
    }

    const loadingImpression = await this.loadingCtrl.create({ message: this.translate.instant('IMPRESSION.PRINTING') });
    await loadingImpression.present();
    try {
      const contenu = this.construireRecu(vente, boutique, imp.largeurColonnes);
      await BluetoothSerial.write({ address: imp.address, value: contenu });
    } finally {
      await loadingImpression.dismiss().catch(() => {});
    }

    await this.toast(this.translate.instant('IMPRESSION.SUCCESS'), 'success');
  }

  /** Beaucoup d'imprimantes thermiques bon marché déjà appairées n'acceptent que la connexion
   *  Bluetooth "insecure" (sans ré-authentification). On tente d'abord la connexion standard,
   *  puis on se rabat sur connectInsecure() en cas d'échec. NON VÉRIFIÉ sur matériel réel. */
  private async connecterAvecRepli(address: string): Promise<void> {
    try {
      await BluetoothSerial.connect({ address });
    } catch {
      try {
        await BluetoothSerial.connectInsecure({ address });
      } catch {
        throw new Error(this.translate.instant('IMPRESSION.CONNECTION_ERROR'));
      }
    }
  }

  private messageErreur(e: any): string {
    if (e instanceof Error && e.message) return e.message;
    return this.translate.instant('IMPRESSION.PRINT_ERROR');
  }

  // ==================== CONSTRUCTION DU REÇU ESC/POS ====================

  /**
   * Construit la chaîne à envoyer telle quelle au plugin. Le pont natif encode cette chaîne
   * en UTF-8 avant de l'écrire sur le port série — pour que les octets de commande ESC/POS
   * (contrôle) et le texte du reçu arrivent intacts sur l'imprimante, TOUT le contenu est donc
   * restreint à l'ASCII 7 bits (0-127) : les accents et caractères non-latins sont supprimés/
   * remplacés (voir stripAscii). C'est une limitation connue et volontaire, cohérente avec le
   * fait que la plupart des imprimantes thermiques bon marché utilisent de toute façon un
   * codepage 8 bits (CP437/850...) et non de l'UTF-8 natif.
   */
  private construireRecu(vente: VenteMap, boutique: BoutiqueInfo, largeur: number): string {
    const bytes: number[] = [];
    const put = (arr: number[]) => { for (const b of arr) bytes.push(b); };
    const ligneTexte = (texte: string) => put(this.texteVersOctets(texte + '\n'));

    put(this.cmdInit());
    put(this.cmdAlign(1));
    put(this.cmdBold(true));
    put(this.cmdTailleDouble(true));
    ligneTexte(boutique?.nom || 'Ma Boutique');
    put(this.cmdTailleDouble(false));
    put(this.cmdBold(false));
    if (boutique?.adresse) ligneTexte(boutique.adresse);
    if (boutique?.telephone) ligneTexte(boutique.telephone);

    put(this.cmdAlign(0));
    ligneTexte(this.ligneSeparation(largeur));

    const date = vente.dateVente ? new Date(vente.dateVente) : new Date();
    const dateStr = date.toLocaleDateString('fr-FR') + ' ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    ligneTexte(`${this.translate.instant('IMPRESSION.SALE_NUMBER')}: ${vente.numeroVente || vente.id}`);
    ligneTexte(dateStr);
    if (vente.vendeurNom) ligneTexte(`${this.translate.instant('IMPRESSION.SELLER')}: ${vente.vendeurNom}`);
    const nomClient = [vente.clientPrenom, vente.clientNom].filter(Boolean).join(' ');
    ligneTexte(`${this.translate.instant('IMPRESSION.CLIENT')}: ${nomClient || this.translate.instant('IMPRESSION.WALK_IN_CLIENT')}`);
    ligneTexte(this.ligneSeparation(largeur));

    const lignes = (vente.lignes?.length ? vente.lignes : vente.produits) || [];
    for (const l of lignes) {
      ligneTexte(l.produitNom || 'Produit');
      const qtePrix = `  ${l.quantite} x ${this.money(l.prixUnitaire)}`;
      const total = this.money(l.sousTotal ?? (l.quantite * l.prixUnitaire));
      ligneTexte(this.deuxColonnes(qtePrix, total, largeur));
    }
    ligneTexte(this.ligneSeparation(largeur));

    put(this.cmdBold(true));
    ligneTexte(this.deuxColonnes(
      this.translate.instant('IMPRESSION.TOTAL_LABEL'),
      this.money(vente.montantApresRemise ?? vente.montantTotal),
      largeur
    ));
    put(this.cmdBold(false));
    ligneTexte(`${this.translate.instant('IMPRESSION.PAYMENT_MODE')}: ${this.venteService.getModePaiementLabel(vente.modePaiement)}`);

    if (vente.estCredit) {
      ligneTexte(this.deuxColonnes(this.translate.instant('IMPRESSION.PAID'), this.money(vente.montantVerse || 0), largeur));
      ligneTexte(this.deuxColonnes(this.translate.instant('IMPRESSION.REMAINING'), this.money(vente.montantRestant || 0), largeur));
    }

    ligneTexte(this.ligneSeparation(largeur));
    put(this.cmdAlign(1));
    ligneTexte(this.translate.instant('IMPRESSION.THANK_YOU'));
    put(this.cmdFeed(3));
    put(this.cmdCut());

    return String.fromCharCode(...bytes);
  }

  // ── Commandes ESC/POS ──────────────────────────────────────────────────

  private cmdInit(): number[] { return [ESC, 0x40]; }
  /** 0 = gauche, 1 = centre, 2 = droite */
  private cmdAlign(mode: 0 | 1 | 2): number[] { return [ESC, 0x61, mode]; }
  private cmdBold(actif: boolean): number[] { return [ESC, 0x45, actif ? 1 : 0]; }
  private cmdTailleDouble(actif: boolean): number[] { return [GS, 0x21, actif ? 0x11 : 0x00]; }
  private cmdFeed(nbLignes: number): number[] { return [ESC, 0x64, nbLignes]; }
  /** Coupe papier totale — non vérifié sur matériel réel (certains modèles n'ont pas de
   *  massicot ou utilisent une commande légèrement différente ; sans effet sur le reste
   *  de l'impression si l'imprimante l'ignore). */
  private cmdCut(): number[] { return [GS, 0x56, 0x00]; }

  // ── Mise en forme texte (ASCII strict, voir construireRecu) ────────────

  private texteVersOctets(texte: string): number[] {
    return this.stripAscii(texte).split('').map(c => c.charCodeAt(0));
  }

  /** Supprime les accents (é→e, à→a...) puis remplace tout caractère non-ASCII restant
   *  (écritures non-latines, symboles) par '?', pour rester dans les 128 valeurs ASCII que
   *  le pont natif peut transmettre sans corruption (voir construireRecu). */
  private stripAscii(texte: string): string {
    return (texte || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x00-\x7F]/g, '?');
  }

  private ligneSeparation(largeur: number): string {
    return '-'.repeat(largeur);
  }

  private deuxColonnes(gauche: string, droite: string, largeur: number): string {
    const d = this.stripAscii(droite).slice(0, largeur);
    const gMax = Math.max(0, largeur - d.length - 1);
    const g = this.stripAscii(gauche).slice(0, gMax);
    const espaces = Math.max(1, largeur - g.length - d.length);
    return g + ' '.repeat(espaces) + d;
  }

  private money(value: number): string {
    return this.venteService.formatPrice(value || 0);
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, color, duration: 2800, position: 'top' });
    await toast.present();
  }
}
