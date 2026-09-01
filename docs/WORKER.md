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

Текущий URL Worker: `https://dayessence-bot.day-essence.workers.dev`

## Смена workers.dev subdomain

В коде URL **не захардкожен** — `setup.ps1` и CI берут его из вывода `wrangler deploy`.

После смены subdomain в Cloudflare (например `yurashoihet` → `day-essence`):

1. Перерегистрируйте webhook (старый `*.workers.dev` перестанет получать апдейты):

```powershell
cd worker
$env:WEBHOOK_SECRET = "<тот же секрет, что в GitHub Secrets>"
$env:WORKER_URL = "https://dayessence-bot.day-essence.workers.dev"
.\register-webhook.ps1
```

Или полный цикл: `.\setup.ps1` (деплой + секреты + webhook).

2. Проверьте: `getWebhookInfo` → URL должен быть `.../day-essence.workers.dev/telegram`.

Mini App (GitHub Pages) и дайджест в каналы **не зависят** от workers.dev subdomain.

## CI

Workflow `.github/workflows/deploy-worker.yml` — деплой при push в `worker/` на `main`.

## Безопасность

- Не коммитьте API Token и `WEBHOOK_SECRET` в репозиторий.
- Если токен попал в чат — перевыпустите в Cloudflare → My Profile → API Tokens.
