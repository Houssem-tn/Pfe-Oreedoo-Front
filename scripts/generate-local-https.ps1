param(
  [string]$LanHost = '192.168.1.83',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$certDir = Join-Path $workspaceRoot 'dev-certs\local-https'
$certFile = Join-Path $certDir 'dev-local.pem'
$keyFile = Join-Path $certDir 'dev-local-key.pem'
$rootCaFile = Join-Path $certDir 'mkcert-rootCA.pem'
$rootCaCrtFile = Join-Path $certDir 'mkcert-rootCA.crt'

if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  throw 'mkcert is required but was not found in PATH.'
}

New-Item -ItemType Directory -Force -Path $certDir | Out-Null

Write-Host 'Installing or refreshing the local mkcert root CA...'
& mkcert -install | Out-Host

if ($Force -or -not (Test-Path $certFile) -or -not (Test-Path $keyFile)) {
  Write-Host "Generating HTTPS certificate for localhost, 127.0.0.1 and $LanHost..."
  & mkcert -cert-file $certFile -key-file $keyFile localhost 127.0.0.1 ::1 $LanHost | Out-Host
} else {
  Write-Host "Existing certificate found at $certFile"
}

$caroot = (& mkcert -CAROOT).Trim()
$sourceRootCa = Join-Path $caroot 'rootCA.pem'

if (Test-Path $sourceRootCa) {
  Copy-Item -Force $sourceRootCa $rootCaFile
  Copy-Item -Force $sourceRootCa $rootCaCrtFile
  Write-Host "Copied mkcert root CA to $rootCaFile"
}

Write-Host ''
Write-Host 'Local HTTPS is ready.'
Write-Host "Frontend certificate: $certFile"
Write-Host "Frontend private key: $keyFile"
Write-Host "Phone trust file: $rootCaFile"
Write-Host "Phone trust file (.crt): $rootCaCrtFile"
