import { Injectable } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'auto';

const STORAGE_KEY = 'app_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {

  private current: ThemeMode = 'auto';
  private mediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  init(): void {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'auto';
    this.apply(saved);

    // Si l'utilisateur est en mode "Auto", on réagit aux changements système
    // (utile pour un aperçu live si l'OS change de thème pendant que l'app est ouverte)
    this.mediaQuery?.addEventListener?.('change', () => {
      if (this.current === 'auto') this.updateStatusBar();
    });
  }

  getCurrent(): ThemeMode {
    return this.current;
  }

  isDarkActive(): boolean {
    if (this.current === 'dark') return true;
    if (this.current === 'light') return false;
    return !!this.mediaQuery?.matches;
  }

  setTheme(mode: ThemeMode): void {
    this.apply(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }

  private apply(mode: ThemeMode): void {
    this.current = mode;
    const body = document.body;
    body.classList.remove('theme-dark', 'theme-light');
    if (mode === 'dark') body.classList.add('theme-dark');
    if (mode === 'light') body.classList.add('theme-light');
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    // Couleur de la barre d'état mobile (meta theme-color) — cohérence visuelle
    const meta = document.querySelector('meta[name="theme-color"]');
    const color = this.isDarkActive() ? '#111827' : '#1a56db';
    if (meta) meta.setAttribute('content', color);
  }
}
