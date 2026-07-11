import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    localStorage.clear();
    service = new TokenService();
  });

  afterEach(() => localStorage.clear());

  it('get() should return null when no token is stored', () => {
    expect(service.get()).toBeNull();
  });

  it('set() then get() should round-trip the token', () => {
    service.set('abc.def.ghi');
    expect(service.get()).toBe('abc.def.ghi');
  });

  it('clear() should remove the stored token', () => {
    service.set('abc.def.ghi');
    service.clear();
    expect(service.get()).toBeNull();
  });

  it('set() should overwrite a previously stored token', () => {
    service.set('first-token');
    service.set('second-token');
    expect(service.get()).toBe('second-token');
  });
});
