import { InjectionToken } from '@angular/core';

export function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }

  const { hostname, origin, port } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLanIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const isAngularDevPort = port === '4200' || port === '4201' || port === '4300';

  if (isAngularDevPort && (isLocalHost || isLanIpv4)) {
    return `http://${hostname}:8080`;
  }

  return origin;
}

export const API_BASE_URL = new InjectionToken<string>(
  'API_BASE_URL',
  {
    providedIn: 'root',
    factory: resolveApiBaseUrl
  }
);
