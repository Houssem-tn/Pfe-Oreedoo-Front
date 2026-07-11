// Test-only helper: builds an unsigned (fake) JWT string so specs can drive
// decodeJwt()/isJwtExpired() without a real backend-issued token. Shared
// because several specs (auth.service, guards) need the same shape.
export function makeFakeJwt(claims: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const header = base64url({ alg: 'none', typ: 'JWT' });
  const payload = base64url(claims);
  return `${header}.${payload}.`;
}
