# news-digest-bot

Twice-daily world news digest for Telegram: RSS → OpenAI → **two channels** (RU + EN) from a single run.

**Day Essence** / **Суть дня** — same set of stories, localized headlines and summaries.

Brand: [brand/BRANDING.md](brand/BRANDING.md) · Story selection: [docs/SELECTION.md](docs/SELECTION.md)

[License](LICENSE) · [Security](SECURITY.md) · [Privacy](PRIVACY.md) · [Notice](NOTICE.md) · [Contributing](CONTRIBUTING.md)

## How it works

1. **GitHub Actions** on cron: **06:00 UTC** (09:00 Minsk) and **18:00 UTC** (21:00 Minsk).
2. Fetch RSS from BBC, AP, CNN, NPR, NYT, Guardian, DW, Euronews, and Al Jazeera.
3. Keep items **since the last successful digest** (not a fixed 24h window); state in `miniapp/data/state.json`.
4. OpenAI picks the **top N** stories and writes **headline + summary in Russian and English**.
5. The bot posts to both channels with an inline **Open in app** button (Telegram Mini App on GitHub Pages).

See [docs/SELECTION.md](docs/SELECTION.md) for the full selection pipeline.

## Quick start

### 1. Telegram

[brand/BRANDING.md](brand/BRANDING.md) — BotFather setup, avatar, channel copy.

| Locale | Username | Env var |
|--------|----------|---------|
| RU | `@dayessence_ru` | `TELEGRAM_CHANNEL_ID_RU` |
| EN | `@dayessence_en` | `TELEGRAM_CHANNEL_ID_EN` |

One **Day Essence** bot must be an admin of **both** channels with permission to post.

### 2. Local run

```bash
git clone https://github.com/hirurg-lybitel/news-digest-bot.git
cd news-digest-bot
cp .env.example .env
# fill in secrets in .env
npm install
npm run digest:dry   # print message, do not post
npm run digest       # fetch, summarize, post
```

### 3. GitHub Secrets & Variables

**Secrets** (Settings → Secrets):

| Secret | Description |
|--------|-------------|
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_SECURITY_KEY` | Proxy security key (see below) |
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_CHANNEL_ID_RU` | e.g. `@dayessence_ru` |
| `TELEGRAM_CHANNEL_ID_EN` | e.g. `@dayessence_en` |

Optional: `OPENAI_PROJECT_KEY` if your OpenAI org uses project-scoped keys.

**Variables** (Settings → Variables):

| Variable | Example |
|----------|---------|
| `MINI_APP_URL` | `https://hirurg-lybitel.github.io/news-digest-bot` |
| `TELEGRAM_BOT_USERNAME` | `dayessence_bot` |
| `MINI_APP_SHORT_NAME` | `digest` |

### OpenAI proxy

Requests go through [chatgpt-proxy.gdmn.app](https://chatgpt-proxy.gdmn.app/openai) when `OPENAI_SECURITY_KEY` is set (default in CI). Override with `OPENAI_PROXY_URL` or set `OPENAI_USE_PROXY=0` to call OpenAI directly.

## Configuration

| Variable | Default | Effect |
|----------|---------|--------|
| `DIGEST_TOP_N` | `10` | Stories per digest |
| `DEFAULT_LOOKBACK_HOURS` | `12` | Window on first run (no state file) |
| `MAX_LOOKBACK_HOURS` | `24` | Cap if a scheduled run was missed |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for selection and copy |

## Project layout

```
src/
  index.ts        # pipeline + multi-channel publish
  fetchNews.ts    # RSS fetch + dedup
  summarize.ts    # AI selection + RU/EN texts
  format.ts       # HTML formatting per locale
  locale.ts       # RU/EN labels
  publishData.ts  # JSON export for Mini App
  digestState.ts  # lastDigestAt lookback window
miniapp/data/     # digest.json + archive (committed by CI)
docs/SELECTION.md
brand/BRANDING.md
```

## Mini App

Each run writes `miniapp/data/digest.json` (and an archive copy). GitHub Actions commits and pushes this data; GitHub Pages serves the web UI. Channel posts link via `t.me/<bot>/<shortname>?startapp=<locale>` so the app opens inside Telegram.

Register the web app URL in BotFather (`/newapp`) and set `MINI_APP_URL`, `TELEGRAM_BOT_USERNAME`, and `MINI_APP_SHORT_NAME` to match.
