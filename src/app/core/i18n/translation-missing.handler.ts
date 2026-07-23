import { inject, Injectable, Injector, isDevMode } from '@angular/core';
import {
  TranslocoMissingHandler,
  TranslocoMissingHandlerData,
  TranslocoService,
} from '@jsverse/transloco';

/**
 * Controlled fallback for keys that are missing in the active language.
 *
 * Resolution order:
 *  1. The configured fallback language (default `fr`) — preserves the app's existing
 *     "fall back to French" behaviour for keys not yet translated in en/ar.
 *  2. A humanized version of the key's last segment (e.g. `notifications.category.stock`
 *     → `Stock`) — so a key missing in *every* language never leaks a raw dotted key
 *     into the UI.
 *
 * Gaps are still logged in dev so the JSON files can be completed; production users
 * only ever see readable text.
 */
@Injectable({ providedIn: 'root' })
export class AppTranslocoMissingHandler implements TranslocoMissingHandler {
  // Resolved lazily to avoid a circular dependency: TranslocoService itself depends on
  // the missing handler, so we must not inject the service eagerly in this handler.
  private readonly injector = inject(Injector);
  private service?: TranslocoService;

  handle(key: string, data: TranslocoMissingHandlerData): string {
    const service = this.getService();
    const fallbackLang = this.resolveFallbackLang(data);
    const activeLang = service?.getActiveLang();

    if (service && fallbackLang && fallbackLang !== activeLang) {
      const fallbackValue = this.lookup(service, fallbackLang, key);
      if (fallbackValue != null && fallbackValue !== '') {
        return fallbackValue;
      }
    }

    if (isDevMode()) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] Missing translation key: "${key}"`);
    }

    return this.humanize(key);
  }

  private getService(): TranslocoService | undefined {
    if (!this.service) {
      this.service = this.injector.get(TranslocoService, undefined) ?? undefined;
    }
    return this.service;
  }

  /** Reads a key from an already-loaded translation map; returns undefined if not loaded/absent. */
  private lookup(service: TranslocoService, lang: string, key: string): string | undefined {
    try {
      const translation = service.getTranslation(lang) as Record<string, unknown> | undefined;
      const value = translation?.[key];
      return typeof value === 'string' ? value : undefined;
    } catch {
      return undefined;
    }
  }

  private resolveFallbackLang(data: TranslocoMissingHandlerData): string | null {
    // TranslocoMissingHandlerData extends TranslocoConfig, so fallbackLang is on `data` itself.
    const fallback = data?.fallbackLang;
    if (Array.isArray(fallback)) {
      return fallback[0] ?? null;
    }
    return fallback ?? null;
  }

  private humanize(key: string): string {
    if (!key) {
      return '';
    }

    const lastSegment = key.split('.').pop() ?? key;
    const words = lastSegment
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase → spaced
      .replace(/[_-]+/g, ' ')                 // snake_case / kebab-case → spaced
      .trim();

    if (!words) {
      return key;
    }

    return words.charAt(0).toUpperCase() + words.slice(1);
  }
}
