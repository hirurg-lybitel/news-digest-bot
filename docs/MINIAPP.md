# Telegram Mini App

Интерактивный дайджest с фильтрами по **разделам** и **источникам**. Дополняет посты в каналах кнопкой «Открыть в приложении».

## URL

После включения GitHub Pages:

```
https://hirurg-lybitel.github.io/news-digest-bot/
```

Env: `MINI_APP_URL` — тот же URL **без** trailing slash.

## Включить GitHub Pages

1. Repo → **Settings → Pages**
2. **Build and deployment → Source:** GitHub Actions
3. Workflow **Deploy Mini App** задеплоит папку `miniapp/`

После первого push в `main` (или ручного Run workflow) сайт станет доступен по HTTPS.

## BotFather

1. `/mybots` → **Day Essence** → **Bot Settings** → **Menu Button** → **Configure menu button**
2. URL: `https://hirurg-lybitel.github.io/news-digest-bot/`

Или через команды:

```
/setmenubutton
@dayessence_bot
https://hirurg-lybitel.github.io/news-digest-bot/
```

Опционально — отдельное приложение:

```
/newapp
@dayessence_bot
Day Essence Digest
https://hirurg-lybitel.github.io/news-digest-bot/
```

Short name: `digest`

## Как это связано с каналами

- Каждый пост в канале заканчивается inline-кнопкой-**ссылкой** (в каналах `web_app` недоступен — только `url`)
- RU канал открывает `?lang=ru`, EN — `?lang=en`
- Данные: `miniapp/data/digest.json` (обновляется при каждом `npm run digest`)

## Локальная разработка

```bash
npm run digest:dry   # обновит miniapp/data/digest.json
npx serve miniapp    # http://localhost:3000
```

Для теста Mini App в Telegram нужен HTTPS (GitHub Pages или ngrok).

## GitHub Actions

| Variable | Значение |
|----------|----------|
| `MINI_APP_URL` | `https://hirurg-lybitel.github.io/news-digest-bot` |

Settings → Secrets and variables → Actions → **Variables**

Workflow `digest.yml` коммитит обновлённый `miniapp/data/` после каждого дайджеста; `pages.yml` деплоит UI.
