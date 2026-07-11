import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

export function resolveApiBaseUrl(): string {
  // Explicit override wins (e.g. API served from a different origin than
  // the frontend). Left '' in all three environment files by default to
  // preserve the dynamic same-origin/proxy behavior below.
  if (environment.apiBaseUrl) {
    return environment.apiBaseUrl;
  }

  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }

  const { hostname, origin, port } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLanIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  const isAngularDevPort = port === '4200' || port === '4201' || port === '4300';
  const isNgrokHost =
    hostname.endsWith('.ngrok-free.dev')
    || hostname.endsWith('.ngrok.io')
    || hostname.endsWith('.ngrok.app');

  // In Angular dev, prefer same-origin /api requests and let the dev-server
  // proxy forward traffic to Spring Boot. This avoids direct browser calls to
  // localhost:8080 from runtimes that may not resolve localhost the same way.
  if (isAngularDevPort && (isLocalHost || isLanIpv4 || isNgrokHost)) {
    return '';
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
