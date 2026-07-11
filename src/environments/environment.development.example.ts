// Copy this file to `environment.development.ts` (git-ignored) and fill in
// your own local values. Used by `ng serve` / dev builds via
// angular.json's fileReplacements.
export const environment = {
  production: false,
  apiBaseUrl: '',
  wsEndpoint: '/ws-notifications',
  wsSockJsEndpoint: '/ws-notifications-sockjs',
  // Public, client-visible MapTiler key — get a free key at
  // https://www.maptiler.com/ and restrict it to your local/dev domains.
  mapTilerKey: '',
  features: {},
};
