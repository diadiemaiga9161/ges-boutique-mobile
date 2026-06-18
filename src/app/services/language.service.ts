import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export interface Language {
  code: string;
  name: string;
  flag: string;
  rtl?: boolean;
}

export const LANGUAGES: Language[] = [
  { code: 'fr', name: 'Français',    flag: '🇫🇷' },
  { code: 'en', name: 'English',     flag: '🇬🇧' },
  { code: 'ar', name: 'العربية',     flag: '🇸🇦', rtl: true },
  { code: 'es', name: 'Español',     flag: '🇪🇸' },
  { code: 'pt', name: 'Português',   flag: '🇵🇹' },
  { code: 'ha', name: 'Hausa',       flag: '🇳🇬' },
  { code: 'wo', name: 'Wolof',       flag: '🇸🇳' },
];

const STORAGE_KEY = 'app_language';

@Injectable({ providedIn: 'root' })
export class LanguageService {

  readonly languages = LANGUAGES;

  constructor(private translate: TranslateService) {}

  init(): void {
    const saved = localStorage.getItem(STORAGE_KEY) || 'fr';
    this.setLanguage(saved);
  }

  setLanguage(code: string): void {
    const lang = LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
    this.translate.use(lang.code);
    localStorage.setItem(STORAGE_KEY, lang.code);
    document.documentElement.setAttribute('lang', lang.code);
    document.documentElement.setAttribute('dir', lang.rtl ? 'rtl' : 'ltr');
  }

  getCurrent(): string {
    return this.translate.currentLang || localStorage.getItem(STORAGE_KEY) || 'fr';
  }

  getCurrentLang(): Language {
    const code = this.getCurrent();
    return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
  }
}
