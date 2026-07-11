// Default/fallback environment. In practice this file is never bundled
// as-is: `angular.json` replaces it with environment.development.ts (dev
// builds/serve) or environment.production.ts (prod builds) via
// `fileReplacements`. It stays tracked and secret-free so a build without
// any matching configuration still compiles safely.
//
// apiBaseUrl: leave '' to use same-origin requests. In dev this lets the
// Angular CLI proxy (proxy.conf.json) forward /api and /ws-notifications to
// the backend. In prod, '' assumes the frontend is served from the same
// origin as the backend (reverse-proxied) — see api.config.ts.
export const environment = {
  production: false,
  apiBaseUrl: '',
  wsEndpoint: '/ws-notifications',
  wsSockJsEndpoint: '/ws-notifications-sockjs',
  // Public, client-visible MapTiler key — NOT a backend secret. Restrict it
  // to your domain(s) in the MapTiler dashboard; git-secrecy only prevents
  // casual scraping, it is not the real security boundary for this key.
  mapTilerKey: '',
  features: {},
};
