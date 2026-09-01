# Re-register Telegram webhook after workers.dev subdomain change (or URL change).
# Does not rotate WEBHOOK_SECRET unless you omit it (then setup.ps1 flow is better).

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

if (-not $env:TELEGRAM_BOT_TOKEN) {
  throw "TELEGRAM_BOT_TOKEN missing. Add it to ../.env or set the env var."
}
if (-not $env:WEBHOOK_SECRET) {
  throw "Set WEBHOOK_SECRET to the value stored in GitHub Secrets / Cloudflare Worker."
}

if (-not $env:WORKER_URL) {
  if (-not $env:CLOUDFLARE_API_TOKEN) {
    throw "Set WORKER_URL (e.g. https://dayessence-bot.day-essence.workers.dev) or CLOUDFLARE_API_TOKEN to detect URL via wrangler deploy."
  }
  if (-not $env:CLOUDFLARE_ACCOUNT_ID) {
    $env:CLOUDFLARE_ACCOUNT_ID = "f314373745ae1d5c468c4dcb8a97c141"
  }

  Write-Host "Detecting Worker URL via wrangler deploy..."
  $prevErrorAction = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $deployOutput = & npx wrangler deploy 2>&1 | ForEach-Object { $_.ToString() }
  } finally {
    $ErrorActionPreference = $prevErrorAction
  }
  $deployOutput | ForEach-Object { Write-Host $_ }
  $env:WORKER_URL = ($deployOutput | Select-String -Pattern 'https://[a-zA-Z0-9._-]+\.workers\.dev' | Select-Object -First 1).Matches.Value
}

if (-not $env:WORKER_URL) {
  throw "Could not determine WORKER_URL."
}

$webhookUrl = "$($env:WORKER_URL.TrimEnd('/'))/telegram"
Write-Host "Registering webhook: $webhookUrl"

$body = @{
  url             = $webhookUrl
  secret_token    = $env:WEBHOOK_SECRET
  allowed_updates = @("message")
} | ConvertTo-Json -Compress

$response = Invoke-RestMethod -Method Post `
  -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/setWebhook" `
  -ContentType "application/json" `
  -Body $body

if (-not $response.ok) {
  throw "setWebhook failed: $($response.description)"
}

$info = Invoke-RestMethod -Uri "https://api.telegram.org/bot$($env:TELEGRAM_BOT_TOKEN)/getWebhookInfo"
Write-Host "Webhook URL: $($info.result.url)"
Write-Host "Done. Test /start in Telegram."
