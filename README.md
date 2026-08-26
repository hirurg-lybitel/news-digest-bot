# news-digest-bot



Ежедневный дайджест главных новостей в Telegram: RSS → OpenAI → пост в 21:00 по Минску.



Два канала из одного запуска: **RU** («Суть дня») и **EN** (Day Essence) — один набор событий, разный язык текста.



Бренд: [brand/BRANDING.md](brand/BRANDING.md) · Отбор новостей: [docs/SELECTION.md](docs/SELECTION.md)



[License](LICENSE) · [Security](SECURITY.md) · [Privacy](PRIVACY.md) · [Notice](NOTICE.md) · [Contributing](CONTRIBUTING.md)



## Как это работает



1. GitHub Actions по cron (`18:00 UTC` = `21:00` Europe/Minsk).

2. RSS из BBC, AP, CNN, NYT, Guardian, DW, Euronews, Al Jazeera, NPR.

3. Предобработка: свежесть 24ч, дедуп по URL, топ-80 кандидатов → OpenAI.

4. AI выбирает **top N** важных событий и пишет **заголовок + саммари на RU и EN**.

5. Бот постит в каналы + кнопка «Открыть в приложении» → [Mini App](docs/MINIAPP.md).

Подробнее: [docs/SELECTION.md](docs/SELECTION.md) · [docs/MINIAPP.md](docs/MINIAPP.md).



## Быстрый старт



### 1. Telegram



[brand/BRANDING.md](brand/BRANDING.md) — BotFather, аватар, тексты каналов.



Каналы:

| Язык | Username | Env |

|------|----------|-----|

| RU | `@dayessence_ru` | `TELEGRAM_CHANNEL_ID_RU` |

| EN | `@dayessence_en` | `TELEGRAM_CHANNEL_ID_EN` |



Один бот **Day Essence** — админ **обоих** каналов с правом постов.



### 2. Локально



```bash

cd D:/git/news-digest-bot

cp .env.example .env

npm install

npm run digest:dry

npm run digest

```



### 3. GitHub Secrets



| Secret | Значение |

|--------|----------|

| `OPENAI_API_KEY` | ключ OpenAI |

| `OPENAI_SECURITY_KEY` | ключ GPT-прокси |

| `TELEGRAM_BOT_TOKEN` | токен бота |

| `TELEGRAM_CHANNEL_ID_RU` | `@dayessence_ru` |

| `TELEGRAM_CHANNEL_ID_EN` | `@dayessence_en` |

**Variable** (Settings → Variables): `MINI_APP_URL` = `https://hirurg-lybitel.github.io/news-digest-bot`



## Настройки



- `DIGEST_TOP_N` — сколько новостей (default `10`)

- `LOOKBACK_HOURS` — окно свежести (default `24`)

- `OPENAI_MODEL` — default `gpt-4o-mini`



## Структура



```

src/

  index.ts        # пайплайн + мульти-канал

  fetchNews.ts    # RSS + дедуп

  summarize.ts    # отбор + RU/EN тексты

  format.ts       # HTML по локали

  locale.ts       # подписи RU/EN
miniapp/          # Telegram Mini App
docs/SELECTION.md
docs/MINIAPP.md

```


