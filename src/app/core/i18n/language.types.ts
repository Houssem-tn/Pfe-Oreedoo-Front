export type AppLanguage = 'en' | 'fr' | 'ar';

export interface LanguageOption {
  code: AppLanguage;
  labelKey: string;
  nativeLabel: string;
  dir: 'ltr' | 'rtl';
  /** BCP-47 locale used for Intl date/number/currency formatting. */
  locale: string;
}

export const APP_LANGUAGES: LanguageOption[] = [
  { code: 'en', labelKey: 'languages.en', nativeLabel: 'English', dir: 'ltr', locale: 'en-US' },
  { code: 'fr', labelKey: 'languages.fr', nativeLabel: 'Français', dir: 'ltr', locale: 'fr-FR' },
  { code: 'ar', labelKey: 'languages.ar', nativeLabel: 'العربية', dir: 'rtl', locale: 'ar-TN' }
];

export const DEFAULT_LANGUAGE: AppLanguage = 'fr';

export const LANGUAGE_STORAGE_KEY = 'app_lang';

export function isAppLanguage(value: string | null | undefined): value is AppLanguage {
  return !!value && APP_LANGUAGES.some((lang) => lang.code === value);
}

export function getLanguageOption(code: AppLanguage): LanguageOption {
  return APP_LANGUAGES.find((lang) => lang.code === code) ?? APP_LANGUAGES[1];
}
