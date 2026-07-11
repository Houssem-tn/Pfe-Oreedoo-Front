# syntax=docker/dockerfile:1
#
# Multi-stage build for the Angular frontend.
#   1. build   — Node (matching package.json's engines.node / the installed
#      Angular CLI version), npm ci, `ng build --configuration production`.
#      Runs the Angular CLI directly rather than `npm run build`, which
#      would trigger the "prebuild" npm lifecycle script
#      (`ng test --browsers=ChromeHeadless`) — running Karma in the image
#      build would require bundling a Chromium binary just for the build
#      stage. See DOCKER.md "Known limitations" for why frontend unit tests
#      stay a separate CI/dev-workflow step instead.
#   2. runtime — nginx (unprivileged variant: non-root by default, listens
#      on 8080 instead of 80), serving only the built static assets.

############################################
# Stage 1: build
############################################
FROM node:22-alpine AS build
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# environment.production.ts is git-ignored (see src/environments/) but
# MUST exist on disk before this build runs — angular.json's production
# fileReplacements swaps it in for src/environments/environment.ts. This
# mirrors the existing non-Docker workflow: copy
# environment.production.example.ts to environment.production.ts and fill
# in real values (the MapTiler key is browser-visible either way — see
# that file's own comments — not a secret this step needs to protect).
RUN test -f src/environments/environment.production.ts || \
    (echo "ERROR: src/environments/environment.production.ts is missing." \
          "Copy src/environments/environment.production.example.ts to" \
          "environment.production.ts and fill in real values before" \
          "building this image (see DOCKER.md)." >&2 && exit 1)

# Public, browser-visible value — not a secret (see the comment on
# mapTilerKey in environment.production.ts) — so passing it as a build ARG
# is the explicitly-allowed exception to "no secrets via build args".
# Optional: only patches the file when docker-compose.yml actually passes
# --build-arg MAPTILER_KEY=..., otherwise the file's own committed value
# (if any) is left alone.
ARG MAPTILER_KEY=""
RUN if [ -n "$MAPTILER_KEY" ]; then \
      sed -i "s#mapTilerKey: '.*'#mapTilerKey: '$MAPTILER_KEY'#" src/environments/environment.production.ts; \
    fi

RUN npx ng build --configuration production

############################################
# Stage 2: runtime
############################################
# Non-root by default (runs as uid 101 "nginx"), listens on 8080 — avoids
# hand-rolling permission fixes on the stock nginx image just to bind a
# privileged port as root.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# The 1.27-alpine tag is a moving tag — it isn't rebuilt every time an
# upstream Alpine package gets a security patch, so a freshly-pulled image
# can still contain an already-fixed CVE (confirmed in practice: the first
# real Trivy scan on GitHub Actions failed on CVE-2026-31789, an OpenSSL
# heap overflow fixed in libssl3/libcrypto3 3.3.7-r0, while this base image
# still shipped 3.3.3-r0). `apk upgrade` at build time pulls whatever's
# actually current at build time regardless of how stale the base image
# itself is. Must run as root (apk needs it) before switching back to the
# base image's own non-root nginx user.
USER root
RUN apk update && apk upgrade --no-cache
USER nginx

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist/coreui-free-angular-admin-template/browser /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

# The base image's own entrypoint already runs `nginx -g "daemon off;"` in
# exec form (PID 1 receives SIGTERM/SIGQUIT directly for a clean shutdown);
# no ENTRYPOINT override needed here.
