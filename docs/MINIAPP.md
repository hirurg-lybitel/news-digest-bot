# Telegram Mini App

Интерактивный дайджest с фильтрами по **разделам** и **источникам**.

## Два URL — не путать

| Назначение | URL | Где используется |
|------------|-----|------------------|
| **Web App (HTTPS)** | `https://hirurg-lybitel.github.io/news-digest-bot/` | BotFather `/newapp`, Menu Button |
| **Deep link (t.me)** | `https://t.me/dayessence_bot/digest?startapp=ru` | Кнопка в постах канала |

Прямая HTTPS-ссылка в канале открывается **во внешнем браузере**.  
Ссылка `t.me/bot/app` открывает Mini App **внутри Telegram**.

## Обязательно: зарегистрировать приложение в BotFather

```
/newapp
@dayessence_bot
Day Essence Digest
https://hirurg-lybitel.github.io/news-digest-bot/
```

Short name: **`digest`** (должен совпадать с `MINI_APP_SHORT_NAME` в `.env`).

Menu Button (тоже HTTPS):

```
/setmenubutton
@dayessence_bot
https://hirurg-lybitel.github.io/news-digest-bot/
```

## Env

```env
MINI_APP_URL=https://hirurg-lybitel.github.io/news-digest-bot
TELEGRAM_BOT_USERNAME=dayessence_bot
MINI_APP_SHORT_NAME=digest
```

Кнопки в каналах автоматически ведут на:
`https://t.me/dayessence_bot/digest?startapp=ru` или `...startapp=en`

Язык в Mini App берётся из `startapp` → `Telegram.WebApp.start_param`.

## GitHub Pages

Settings → Pages → Source: **GitHub Actions** → workflow **Deploy Mini App**.

## GitHub Actions Variable

| Variable | Value |
|----------|--------|
| `MINI_APP_URL` | `https://hirurg-lybitel.github.io/news-digest-bot` |

Опционально Variables: `TELEGRAM_BOT_USERNAME`, `MINI_APP_SHORT_NAME`.

## Кнопки в каналах

- В каналах inline `web_app` **недоступен** — используем `url` с **t.me** deep link
- Это открывает зарегистрированное Mini App внутри клиента Telegram

## Локальная разработка

```bash
npm run digest:dry
npx serve miniapp
```

Для теста в Telegram — только HTTPS (GitHub Pages или ngrok) + `/newapp` в BotFather.
