import { InjectionToken } from '@angular/core';

export function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }

  return window.location.origin;
}

export const API_BASE_URL = new InjectionToken<string>(
  'API_BASE_URL',
  {
    providedIn: 'root',
    factory: resolveApiBaseUrl
  }
);
