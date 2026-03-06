export function decodeJwt<T = any>(token: string): T | null {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string): boolean {
  const claims = decodeJwt<{ exp?: number }>(token);
  if (!claims?.exp) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return claims.exp <= nowSec;
}