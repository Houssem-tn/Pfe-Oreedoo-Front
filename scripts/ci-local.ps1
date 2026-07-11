# Reproduces .github/workflows/ci.yml's `validate` + `npm-audit` jobs
# locally — same npm scripts CI runs, no separate logic to keep in sync.
#
# Usage: .\scripts\ci-local.ps1
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host "==> npm ci"
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

Write-Host "==> ESLint (full report)"
npx ng lint --format json --output-file eslint-report.json
# non-fatal here on purpose — the baseline gate below is the real check

Write-Host "==> ESLint baseline gate (fails only on NEW violations beyond .eslint-baseline.json)"
npm run lint:baseline:check
if ($LASTEXITCODE -ne 0) { throw "ESLint baseline gate failed" }

Write-Host "==> Unit tests (headless Chrome)"
npm run test:ci
if ($LASTEXITCODE -ne 0) { throw "Tests failed" }

Write-Host "==> Production build"
if (-not (Test-Path "src/environments/environment.production.ts")) {
    Write-Host "environment.production.ts missing — copying the tracked example (see DOCKER.md)."
    Copy-Item "src/environments/environment.production.example.ts" "src/environments/environment.production.ts"
}
npx ng build --configuration production
if ($LASTEXITCODE -ne 0) { throw "Production build failed" }

Write-Host "==> npm audit (production dependencies — known baseline, see CI.md)"
npm audit --omit=dev

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "==> Docker build (validation only, no push)"
    docker build -t ooredoo-frontend:ci-local .
} else {
    Write-Host "==> Docker not installed locally — skipping image build (CI still runs it)"
}

Write-Host "==> Done. Reports: eslint-report.json, coverage/coreui-free-angular-admin-template/, npm audit output above"
