# One-time setup: Worker secrets + Telegram webhook.
# Requires: worker/node_modules (npm ci), CLOUDFLARE_API_TOKEN, TELEGRAM_BOT_TOKEN in ../.env

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"').Trim("'")
      if (-not [string]::IsNullOrWhiteSpace($value)) {
        Set-Item -Path "env:$name" -Value $value
      }
    }
  }
}

if (-not $env:CLOUDFLARE_API_TOKEN) {
  throw "Set CLOUDFLARE_API_TOKEN (Cloudflare API token with Workers edit access)."
}
if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
  $env:CLOUDFLARE_ACCOUNT_ID = "f314373745ae1d5c468c4dcb8a97c141"
}
if (-not $env:TELEGRAM_BOT_TOKEN) {
  throw "TELEGRAM_BOT_TOKEN missing. Add it to ../.env or set the env var."
}
if (-not $env:WEBHOOK_SECRET) {
  $chars = (48..57) + (65..90) + (97..122) | ForEach-Object { [char]$_ }
  $env:WEBHOOK_SECRET = -join (1..48 | ForEach-Object { $chars | Get-Random })
  Write-Host "Generated WEBHOOK_SECRET (save to GitHub Secrets): $env:WEBHOOK_SECRET"
}

Write-Host "Uploading Worker secrets..."
$env:TELEGRAM_BOT_TOKEN | npx wrangler secret put TELEGRAM_BOT_TOKEN
$env:WEBHOOK_SECRET | npx wrangler secret put WEBHOOK_SECRET

Write-Host "Deploying Worker..."
$prevErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $deployOutput = & npx wrangler deploy 2>&1 | ForEach-Object { $_.ToString() }
} finally {
  $ErrorActionPreference = $prevErrorAction
}
$deployOutput | ForEach-Object { Write-Host $_ }
$workerUrl = ($deployOutput | Select-String -Pattern 'https://[a-zA-Z0-9._-]+\.workers\.dev' | Select-Object -First 1).Matches.Value
if (-not $workerUrl) {
  throw "Could not detect workers.dev URL from wrangler deploy output."
}

$webhookUrl = "$workerUrl/telegram"
Write-Host "Registering webhook: $webhookUrl"

$body = @{
  url            = $webhookUrl
  secret_token   = $env:WEBHOOK_SECRET
  allowed_updates = @("message")
} | ConvertTo-Json -Compress

$response = Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/setWebhook" `
  -ContentType "application/json" `
  -Body $body

if (-not $response.ok) {
  throw "setWebhook failed: $($response.description)"
}

Write-Host "Done. Test /start in Telegram."
Write-Host "Worker URL: $workerUrl"
