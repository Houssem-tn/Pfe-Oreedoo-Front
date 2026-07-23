import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import {
  APP_LANGUAGES,
  AppLanguage,
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LanguageOption,
  getLanguageOption,
  isAppLanguage
} from './language.types';

/**
 * Owns the active UI language: resolves the initial language (saved
 * preference -> browser language -> French fallback), keeps <html
 * lang/dir> in sync, and persists changes to localStorage so the choice
 * survives login/logout and page reloads.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  private readonly _currentLang = signal<AppLanguage>(DEFAULT_LANGUAGE);
  readonly currentLang = this._currentLang.asReadonly();

  readonly currentOption = computed<LanguageOption>(() => getLanguageOption(this._currentLang()));
  readonly isRtl = computed<boolean>(() => this.currentOption().dir === 'rtl');

  readonly availableLanguages: LanguageOption[] = APP_LANGUAGES;

  /** Must be called once, early during app bootstrap. */
  init(): void {
    const initialLang = this.resolveInitialLanguage();
    this.applyLanguage(initialLang, { persist: false });
  }

  setLanguage(lang: AppLanguage): void {
    this.applyLanguage(lang, { persist: true });
  }

  private resolveInitialLanguage(): AppLanguage {
    const saved = this.readStoredLanguage();
    if (saved) {
      return saved;
    }

    const browserLang = this.document.defaultView?.navigator?.language?.slice(0, 2).toLowerCase();
    if (isAppLanguage(browserLang)) {
      return browserLang;
    }

    return DEFAULT_LANGUAGE;
  }

  private readStoredLanguage(): AppLanguage | null {
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return isAppLanguage(stored) ? stored : null;
    } catch {
      // localStorage unavailable (e.g. privacy mode) — fall through to detection.
      return null;
    }
  }

  private applyLanguage(lang: AppLanguage, options: { persist: boolean }): void {
    this._currentLang.set(lang);
    this.transloco.setActiveLang(lang);

    const option = getLanguageOption(lang);
    const html = this.document.documentElement;
    html.setAttribute('lang', lang);
    html.setAttribute('dir', option.dir);

    if (options.persist) {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      } catch {
        // Ignore persistence failures — the in-memory language still applies.
      }
    }
  }
}
