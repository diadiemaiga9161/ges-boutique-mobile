import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

const BOUTIQUE_URL_KEY = 'selected_boutique_url';
const BOUTIQUE_NOM_KEY = 'selected_boutique_nom';

@Injectable({ providedIn: 'root' })
export class BoutiqueConfigService {
  private currentUrl: string = '';
  private currentNom: string = '';

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
