# Bot webhook (Cloudflare Worker)

Отвечает на `/start` и `/help` в личке с ботом: короткий текст + кнопка Mini App.

Дайджест в каналы по-прежнему идёт через GitHub Actions (`digest.yml`).

## Что нужно в GitHub Secrets

| Secret | Значение |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | API Token с правом *Edit Cloudflare Workers* |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID из Cloudflare Dashboard |
| `TELEGRAM_BOT_TOKEN` | тот же, что для дайджеста |
| `WEBHOOK_SECRET` | случайная строка 32+ символов (защита webhook) |

Сгенерировать `WEBHOOK_SECRET` (только `A–Z`, `a–z`, `0–9`, `_`, `-` — без `=` и прочих символов):

```powershell
$chars = (48..57) + (65..90) + (97..122) | ForEach-Object { [char]$_ }
-join (1..48 | ForEach-Object { $chars | Get-Random })
```

Или запустите `worker/setup.ps1` — секрет сгенерируется автоматически.

## Локальный деплой

Быстрый путь (читает `TELEGRAM_BOT_TOKEN` из `../.env`):

```powershell
cd worker
npm ci
$env:CLOUDFLARE_API_TOKEN = "..."
$env:CLOUDFLARE_ACCOUNT_ID = "..."
.\setup.ps1
```

Ручной путь:

```bash
cd worker
npm ci
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
printf '%s' "$TELEGRAM_BOT_TOKEN" | npx wrangler secret put TELEGRAM_BOT_TOKEN
printf '%s' "$WEBHOOK_SECRET" | npx wrangler secret put WEBHOOK_SECRET
npx wrangler deploy
```

Зарегистрировать webhook (подставьте URL из вывода `wrangler deploy`):

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://dayessence-bot.<subdomain>.workers.dev/telegram\",\"secret_token\":\"$WEBHOOK_SECRET\",\"allowed_updates\":[\"message\"]}"
```

Проверка: `getWebhookInfo`, затем `/start` боту в Telegram.

## CI

Workflow `.github/workflows/deploy-worker.yml` — деплой при push в `worker/` на `main`.

## Безопасность

- Не коммитьте API Token и `WEBHOOK_SECRET` в репозиторий.
- Если токен попал в чат — перевыпустите в Cloudflare → My Profile → API Tokens.
