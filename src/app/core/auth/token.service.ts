import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'access_token';

@Injectable({ providedIn: 'root' })
export class TokenService {
  get(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  set(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}