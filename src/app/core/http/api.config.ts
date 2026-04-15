import { InjectionToken } from '@angular/core';

export function resolveApiBaseUrl(): string {
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
