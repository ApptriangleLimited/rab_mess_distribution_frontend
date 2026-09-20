# Pack this repo (no node_modules / .next / .env) and SCP it to /tmp on the server.
# Usage (PowerShell, from the repo root):
#   $env:DEPLOY_HOST = "your.server.ip"
#   $env:DEPLOY_USER = "ubuntu"
#   .\scripts\scp-upload.ps1
# Optional: $env:DEPLOY_KEY = "C:\path\to\id_rsa"

$ErrorActionPreference = "Stop"

$HostName = $env:DEPLOY_HOST
$User = $env:DEPLOY_USER
if (-not $HostName -or -not $User) {
  Write-Error "Set DEPLOY_HOST and DEPLOY_USER, then re-run."
}

$RemoteTmp = if ($env:REMOTE_TMP) { $env:REMOTE_TMP } else { "/tmp/rab-mess-frontend" }
$Key = $env:DEPLOY_KEY
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Tar = Join-Path $env:TEMP "rab-mess-frontend.tgz"

Write-Host "Packing $RepoRoot -> $Tar"
if (Test-Path $Tar) { Remove-Item $Tar -Force }

Push-Location $RepoRoot
try {
  tar -czf $Tar `
    --exclude=.git `
    --exclude=node_modules `
    --exclude=.next `
    --exclude=.env `
    --exclude=.env.local `
    --exclude=backups `
    --exclude=*.tgz `
    .
} finally {
  Pop-Location
}

$ScpArgs = @()
$SshArgs = @()
if ($Key) {
  $ScpArgs += @("-i", $Key)
  $SshArgs += @("-i", $Key)
}

Write-Host "Uploading to ${User}@${HostName}:/tmp/rab-mess-frontend.tgz"
& scp @ScpArgs $Tar "${User}@${HostName}:/tmp/rab-mess-frontend.tgz"

$Remote = @"
set -euo pipefail
rm -rf '$RemoteTmp'
mkdir -p '$RemoteTmp'
tar -xzf /tmp/rab-mess-frontend.tgz -C '$RemoteTmp'
chmod +x '$RemoteTmp'/scripts/*.sh
echo "Extracted to $RemoteTmp"
ls '$RemoteTmp'/package.json '$RemoteTmp'/docker-compose.yml
"@

Write-Host "Extracting on the server..."
& ssh @SshArgs "${User}@${HostName}" $Remote
Write-Host "Upload ready. On the server run:"
Write-Host "  bash $RemoteTmp/scripts/inspect-server-ports.sh"
Write-Host "  sudo bash $RemoteTmp/scripts/server-deploy.sh"
