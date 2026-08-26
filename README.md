# news-digest-bot

Ежедневный дайджест главных новостей в Telegram-канал: RSS → OpenAI → пост в 21:00 по Минску.

## Как это работает

1. GitHub Actions запускается по cron (`18:00 UTC` = `21:00` Europe/Minsk).
2. Скрипт собирает новости из RSS (BBC, Reuters, CNN, NYT, Guardian, DW, Al Jazeera).
3. OpenAI выбирает топ важных событий и пишет краткие саммари на русском.
4. Бот публикует дайджест в ваш канал со ссылками на оригиналы.

## Быстрый старт

### 1. Telegram

1. Создайте бота у [@BotFather](https://t.me/BotFather) → получите `TELEGRAM_BOT_TOKEN`.
2. Создайте канал и добавьте бота **администратором** с правом публиковать сообщения.
3. Узнайте `TELEGRAM_CHANNEL_ID`:
   - для публичного канала: `@your_channel_username`
   - для приватного: перешлите пост в [@userinfobot](https://t.me/userinfobot) или используйте числовой id вида `-100...`

### 2. Локально

```bash
cd D:/git/news-digest-bot
cp .env.example .env
# заполните OPENAI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID
npm install
npm run digest:dry   # только сгенерировать текст
npm run digest       # отправить в канал
```

### 3. GitHub Secrets

В репозитории: **Settings → Secrets and variables → Actions** добавьте:

| Secret | Значение |
|--------|----------|
| `OPENAI_API_KEY` | ключ OpenAI |
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `TELEGRAM_CHANNEL_ID` | `@channel` или `-100...` |

Затем: **Actions → Daily News Digest → Run workflow** для тестового запуска.

## Расписание

| Место | Время |
|-------|--------|
| Минск | 21:00 |
| UTC (cron) | `0 18 * * *` |

Ручной запуск: вкладка Actions → `workflow_dispatch`.

## Настройки

Через env:

- `OPENAI_MODEL` — по умолчанию `gpt-4o-mini`
- `DIGEST_TOP_N` — сколько новостей в посте (по умолчанию `10`)
- `LOOKBACK_HOURS` — окно свежести (по умолчанию `24`)

Источники: `src/sources.ts`.

## Структура

```
src/
  index.ts        # пайплайн
  fetchNews.ts    # RSS
  summarize.ts    # OpenAI
  format.ts       # HTML для Telegram
  telegram.ts     # Bot API
  sources.ts      # ленты
.github/workflows/digest.yml
```
