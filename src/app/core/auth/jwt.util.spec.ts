import { decodeJwt, isJwtExpired } from './jwt.util';
import { makeFakeJwt } from './testing/jwt-test-helper';

describe('jwt.util', () => {
  describe('decodeJwt', () => {
    it('should decode a well-formed token payload', () => {
      const token = makeFakeJwt({ sub: 'zm@example.com', role: 'ROLE_ZM' });
      const claims = decodeJwt<{ sub: string; role: string }>(token);

      expect(claims?.sub).toBe('zm@example.com');
      expect(claims?.role).toBe('ROLE_ZM');
    });

    it('should return null for a malformed token', () => {
      expect(decodeJwt('not-a-real-token')).toBeNull();
    });

    it('should return null for an empty string', () => {
      expect(decodeJwt('')).toBeNull();
    });
  });

  describe('isJwtExpired', () => {
    it('should return false when the token has no exp claim', () => {
      const token = makeFakeJwt({ sub: 'user@example.com' });
      expect(isJwtExpired(token)).toBeFalse();
    });

    it('should return false for a token expiring in the future', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = makeFakeJwt({ sub: 'user@example.com', exp: futureExp });
      expect(isJwtExpired(token)).toBeFalse();
    });

    it('should return true for a token that already expired', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const token = makeFakeJwt({ sub: 'user@example.com', exp: pastExp });
      expect(isJwtExpired(token)).toBeTrue();
    });

    it('should return true for a token expiring exactly now', () => {
      const nowExp = Math.floor(Date.now() / 1000);
      const token = makeFakeJwt({ sub: 'user@example.com', exp: nowExp });
      expect(isJwtExpired(token)).toBeTrue();
    });
  });
});
