#!/usr/bin/env bash
# Reproduces .github/workflows/ci.yml's `validate` + `npm-audit` jobs
# locally — same npm scripts CI runs, no separate logic to keep in sync.
#
# Usage: ./scripts/ci-local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> npm ci"
npm ci

echo "==> ESLint (full report)"
npx ng lint --format json --output-file eslint-report.json || true

echo "==> ESLint baseline gate (fails only on NEW violations beyond .eslint-baseline.json)"
npm run lint:baseline:check

echo "==> Unit tests (headless Chrome)"
npm run test:ci

echo "==> Production build"
if [ ! -f src/environments/environment.production.ts ]; then
  echo "environment.production.ts missing — copying the tracked example (see DOCKER.md)."
  cp src/environments/environment.production.example.ts src/environments/environment.production.ts
fi
npx ng build --configuration production

echo "==> npm audit (production dependencies — known baseline, see CI.md)"
npm audit --omit=dev || true

if command -v docker >/dev/null 2>&1; then
  echo "==> Docker build (validation only, no push)"
  docker build -t ooredoo-frontend:ci-local .
else
  echo "==> Docker not installed locally — skipping image build (CI still runs it)"
fi

echo "==> Done. Reports: eslint-report.json, coverage/coreui-free-angular-admin-template/, npm audit output above"
