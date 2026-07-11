# Pfe-Oreedoo-Front

## Configuration

Angular build configurations select an environment file via `fileReplacements` in
`angular.json` — code always imports from `src/environments/environment.ts`, but the
build swaps in `environment.development.ts` (dev serve/build) or
`environment.production.ts` (prod build). `environment.ts` itself stays tracked and
secret-free since it's never actually bundled once those replacements are wired.

`environment.development.ts` and `environment.production.ts` are git-ignored (they can
hold real local/prod values) — set them up once per machine:

```bash
npm run env:setup
```

```powershell
npm run env:setup
```

This copies `environment.development.example.ts` → `environment.development.ts` and
`environment.production.example.ts` → `environment.production.ts` (skips files that
already exist). Then edit the real files and fill in your values — at minimum, a
MapTiler key (see below).

### Required/available environment fields

| Field | Meaning |
|---|---|
| `production` | Angular production flag |
| `apiBaseUrl` | Backend origin override. Leave `''` for local dev (uses the Angular CLI proxy, `proxy.conf.json`) and for prod (assumes same-origin, reverse-proxied backend). Only set if the API is on a different origin. |
| `wsEndpoint` / `wsSockJsEndpoint` | STOMP WebSocket / SockJS-fallback paths, appended to the resolved API origin. |
| `mapTilerKey` | MapTiler API key for the base map style — see below. |
| `features` | Reserved for future feature flags. |

### MapTiler key

`mapTilerKey` is a **public, client-visible** key — it ships inside the compiled
JavaScript bundle regardless of git history, so it is not a backend secret. Get a free
key at https://www.maptiler.com/ and, in the MapTiler dashboard, **restrict it to your
domain(s)** (localhost for dev, your real domain for prod) — that domain restriction is
the actual security boundary, not keeping the key out of git.

### Running locally

Local dev continues to go through the Angular CLI proxy (`proxy.conf.json`), which
forwards `/api` and `/ws-notifications*` to the backend on `localhost:8080` — this is
unchanged by the environment setup above.

```bash
npm start
```

### Production build

```bash
npm run build
```

Uses `environment.production.ts` (see setup above) — this file must contain real
values (or at least a working, domain-restricted MapTiler key) before building for a
real deployment; the default `apiBaseUrl: ''` still assumes the frontend is served
from the same origin as the backend.

### Secrets

Never commit real values in `environment.development.ts` / `environment.production.ts`
— they're git-ignored on purpose. See `CONTRIBUTING.md`.
