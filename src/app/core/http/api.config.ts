import { InjectionToken } from '@angular/core';

const API_PORT = '8080';
const LAN_HOST = '192.168.1.83';

export function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined' || !window.location) {
    return `http://localhost:${API_PORT}`;
  }

  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = window.location.hostname?.trim();

  if (!hostname) {
    return `http://localhost:${API_PORT}`;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:${API_PORT}`;
  }

  if (hostname === LAN_HOST) {
    return `${protocol}//${LAN_HOST}:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = new InjectionToken<string>(
	'API_BASE_URL',
	{
		providedIn: 'root',
		factory: resolveApiBaseUrl
	}
);
