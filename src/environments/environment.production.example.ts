// Copy this file to `environment.production.ts` (git-ignored) and fill in
// real production values before running a production build.
export const environment = {
  production: true,
  // '' assumes the frontend is served from the same origin as the backend
  // (reverse-proxied). Set an absolute URL only if the API lives on a
  // different origin than the deployed frontend.
  apiBaseUrl: '',
  wsEndpoint: '/ws-notifications',
  wsSockJsEndpoint: '/ws-notifications-sockjs',
  // Public, client-visible MapTiler key — use a key restricted (in the
  // MapTiler dashboard) to your production domain(s), NOT the same key used
  // for local development.
  mapTilerKey: '',
  features: {},
};
