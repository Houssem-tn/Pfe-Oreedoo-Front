import { EnvironmentProviders, isDevMode } from '@angular/core';
import { provideTransloco, provideTranslocoMissingHandler } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';
import { AppTranslocoMissingHandler } from './translation-missing.handler';

/** Registered once in app.config.ts; drives the root ("common") translation scope. */
export function provideAppTransloco(): EnvironmentProviders[] {
  return [
    ...provideTransloco({
      config: {
        availableLangs: ['en', 'fr', 'ar'],
        defaultLang: 'fr',
        fallbackLang: 'fr',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: {
          // Missing keys resolve to the French fallback instead of showing raw keys...
          useFallbackTranslation: true,
          // ...and are logged to the console so gaps are caught during development.
          logMissingKey: isDevMode()
        }
      },
      loader: TranslocoHttpLoader
    }),
    // Controlled last-resort fallback: fall back to French, then to a humanized key
    // segment, so a missing key never surfaces as a raw dotted string in the UI.
    provideTranslocoMissingHandler(AppTranslocoMissingHandler)
  ];
}
