import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

const BOUTIQUE_URL_KEY = 'selected_boutique_url';
const BOUTIQUE_NOM_KEY = 'selected_boutique_nom';

@Injectable({ providedIn: 'root' })
export class BoutiqueConfigService {
  private currentUrl: string = '';
  private currentNom: string = '';

  // Liste "Boutiques partenaires" de la boutique quittée, capturée juste avant la
  // déconnexion (changerBoutique()) pour que l'écran de sélection puisse l'afficher
  // sans session valide. Purement en mémoire : jamais persistée, jamais nécessaire
  // au tout premier lancement (fallback sur environment.boutiques dans ce cas).
  private partenairesCache: { nom: string; url: string }[] | null = null;

  /**
   * Adresse de boutique sûre : seulement http(s), sinon null. Les adresses des boutiques
   * partenaires sont saisies dans l'appli : sans ce contrôle, une adresse "javascript:..."
   * serait exécutée au moment de changer de boutique.
   */
  static adresseSure(url: string | null | undefined): string | null {
    try {
      const u = new URL(String(url ?? '').trim());
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
      return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
    } catch {
      return null;
    }
  }

  setPartenairesCache(liste: { nom: string; url: string }[]): void {
    // Les adresses non http(s) sont écartées dès la mise en cache.
    this.partenairesCache = liste
      .map(p => ({ nom: p.nom, url: BoutiqueConfigService.adresseSure(p.url) }))
      .filter((p): p is { nom: string; url: string } => !!p.url);
  }

  getPartenairesCache(): { nom: string; url: string }[] | null {
    return this.partenairesCache;
  }

  async init(): Promise<void> {
    if (!environment.isCapacitor) return;

    try {
      const { Preferences } = await import('@capacitor/preferences');
      const urlResult = await Preferences.get({ key: BOUTIQUE_URL_KEY });
      const nomResult = await Preferences.get({ key: BOUTIQUE_NOM_KEY });
      this.currentUrl = urlResult.value || '';
      this.currentNom = nomResult.value || '';
    } catch {
      this.currentUrl = localStorage.getItem(BOUTIQUE_URL_KEY) || '';
      this.currentNom = localStorage.getItem(BOUTIQUE_NOM_KEY) || '';
    }
  }

  getApiBaseUrl(): string {
    return this.currentUrl;
  }

  getBoutiqueName(): string {
    return this.currentNom;
  }

  async setBoutique(nom: string, url: string): Promise<void> {
    this.currentUrl = url;
    this.currentNom = nom;
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: BOUTIQUE_URL_KEY, value: url });
      await Preferences.set({ key: BOUTIQUE_NOM_KEY, value: nom });
    } catch {
      localStorage.setItem(BOUTIQUE_URL_KEY, url);
      localStorage.setItem(BOUTIQUE_NOM_KEY, nom);
    }
  }

  async clearBoutique(): Promise<void> {
    this.currentUrl = '';
    this.currentNom = '';
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key: BOUTIQUE_URL_KEY });
      await Preferences.remove({ key: BOUTIQUE_NOM_KEY });
    } catch {
      localStorage.removeItem(BOUTIQUE_URL_KEY);
      localStorage.removeItem(BOUTIQUE_NOM_KEY);
    }
  }

  isConfigured(): boolean {
    return !!this.currentUrl;
  }
}
