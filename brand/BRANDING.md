# Brand pack: Day Essence («Суть дня»)

Ready-to-paste copy for [@BotFather](https://t.me/BotFather).  
Avatar: [`brand/avatar.png`](avatar.png) (1:1 — use for the bot and the channel).

Digest posts: **Russian** in `@dayessence_ru`, **English** in `@dayessence_en` (same stories, same bot).

---

## Identity

| Field | Value |
|------|----------|
| Brand (EN) | **Day Essence** |
| Brand (RU, channel/posts) | **Суть дня** |
| Positioning | Evening briefing of the day’s top world news — short summaries with links to originals |
| Tone | Calm, editorial; no clickbait, no emoji spam |
| Publish time | Daily at **21:00** (Minsk / Europe/Minsk) |

### Usernames (check availability)

**Bot (preferred first):**
1. `@dayessence_bot`
2. `@sutdnya_bot`
3. `@day_essence_bot`
4. `@sutdnya_digest_bot`

**RU channel (live):**
1. `@dayessence_ru` — https://t.me/dayessence_ru

**EN channel (recommended):**
1. `@dayessence_en` — pairs with RU, easy to find in search
2. `@dayessence` (fallback if `_en` taken)

If taken, use the next option.

---

## BotFather setup

Send commands in order:

### `/newbot`

- **Name:** `Day Essence`
- **Username:** `dayessence_bot` (or a fallback from the list above)

Save the token → `TELEGRAM_BOT_TOKEN`.

### `/setdescription` → select the bot

```
Publishes daily world-news digests to Day Essence channels (RU + EN): concise summaries with links to original stories. Posted every day at 21:00 Minsk time.
```

### `/setabouttext` → select the bot

```
Editorial publishing bot for Day Essence. Aggregates public RSS feeds, ranks the day’s most important stories with AI, and posts a short evening briefing with source links.
```

### `/setuserpic` → select the bot

Upload: `brand/avatar.png`

### `/setcommands` → select the bot

Optional for a channel-only poster:

```
start - About Day Essence
help - How to read the digest
```

### `/setjoingrouproups` → `Disable`

Channel admin only — not intended for groups.

### `/setprivacy`

Leave the default; not critical for a channel poster.

---

## Channel setup (audience-facing, Russian)

1. Telegram → New Channel  
2. **Title:** `Суть дня`  
3. **Description:**

```
Главные мировые новости за день — коротко и по делу.

Каждый вечер в 21:00 (Минск): топ событий, краткое саммари на русском и ссылка на развёрнутый материал первоисточника.

Источники: BBC, CNN, NYT, Guardian, DW, Euronews, Al Jazeera, NPR и др.
Не официальный канал агентств · дайджест автоматизирован
```

4. **Avatar:** `brand/avatar.png`  
5. Username: `@dayessence_ru`  
6. Add the bot as **administrator** with **Post messages**  
7. `TELEGRAM_CHANNEL_ID_RU` = `@dayessence_ru`

---

## English channel setup

1. Telegram → New Channel  
2. **Title:** `Day Essence`  
3. **Username:** `@dayessence_en`  
4. **Description:**

```
Top world news of the day — concise and to the point.

Every evening at 21:00 Minsk time: the most important stories, short summaries in English, and a link to the full original article.

Sources: BBC, AP, CNN, NYT, Guardian, DW, Euronews, Al Jazeera, NPR.
Not affiliated with news agencies · automated digest
```

5. **Avatar:** `brand/avatar.png`  
6. Add the same **Day Essence** bot as admin with **Post messages**  
7. `TELEGRAM_CHANNEL_ID_EN` = `@dayessence_en`

### Suggested pinned post (EN)

```
Welcome to Day Essence.

Once a day — a compact digest of the world’s most important events.
If a story catches your eye, follow the link to the original source.

📅 Published daily at 21:00 (Minsk)
🔗 We don’t republish full articles — only a short summary + source link
```

### Suggested pinned post

```
Добро пожаловать в «Суть дня».

Раз в сутки — сжатый дайджест важных мировых событий.
Если тема зацепила — переходите по ссылке к оригиналу.

📅 Публикация: ежедневно в 21:00 (Минск)
🔗 Мы не перепечатываем статьи целиком — только краткое саммари + источник
```

---

## Visual system

| Token | Value |
|---------|----------|
| Primary | Navy `#0B1F33` |
| Accent | Evening amber `#E8A54B` |
| Posts | Text + links (no cover images) |
| Emoji | Minimal |

---

## Pre-flight checklist

- [ ] Bot created; token in Secrets / `.env`
- [ ] Bot and channel avatars uploaded
- [ ] English Description / About set in BotFather
- [ ] Bot is channel admin with post permission
- [ ] `TELEGRAM_CHANNEL_ID_RU` and `TELEGRAM_CHANNEL_ID_EN` verified
- [ ] Channel description + pinned post live
