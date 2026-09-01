# Brand pack: Day Essence («Суть дня»)

Ready-to-paste copy for [@BotFather](https://t.me/BotFather).  
Avatar: [`brand/avatar.png`](avatar.png) (1:1 — use for the bot and the channel).  
Alternative avatar (globe from Mini App cover, solid navy background): [`brand/avatar-from-cover.png`](avatar-from-cover.png).

Digest posts: **Russian** in `@dayessence_ru`, **English** in `@dayessence_en` (same stories, same bot).

---

## Identity

| Field | Value |
|------|----------|
| Brand (EN) | **Day Essence** |
| Brand (RU, posts) | **Суть дня** |
| **Channel title (EN)** | **World News · Day Essence** |
| **Channel title (RU)** | **Мировые новости · Суть дня** |
| Positioning | Twice-daily briefing of top world news — short summaries with links to originals |
| Tone | Calm, editorial; no clickbait, no emoji spam |
| Publish time | Twice daily: **06:00 & 18:00 UTC** (09:00 & 21:00 Minsk) |

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
Publishes world-news digests twice daily (06:00 & 18:00 UTC) to World News · Day Essence and Мировые новости · Суть дня on Telegram: concise summaries with links to original stories.
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
2. **Title:** `Мировые новости · Суть дня`  
3. **Description:**

```
Мировые новости за день — коротко и по делу. Канал «Суть дня».

Два раза в сутки в 09:00 и 21:00 (Минск): топ событий с прошлого выпуска, краткое саммари на русском и ссылка на первоисточник.

Источники: BBC, CNN, NYT, Guardian, DW, Euronews, Al Jazeera, NPR и др.
Не официальный канал агентств · дайджест автоматизирован
t.me/dayessence_ru
```

4. **Avatar:** `brand/avatar.png`  
5. Username: `@dayessence_ru`  
6. Add the bot as **administrator** with **Post messages**  
7. `TELEGRAM_CHANNEL_ID_RU` = `@dayessence_ru`

---

## English channel setup

1. Telegram → New Channel  
2. **Title:** `World News · Day Essence`  
3. **Username:** `@dayessence_en`  
4. **Description:**

```
World news of the day — concise and to the point. Day Essence digest.

Twice daily at 09:00 and 21:00 Minsk time: top stories since the last briefing, short summaries in English, and a link to the full original article.

Sources: BBC, AP, CNN, NYT, Guardian, DW, Euronews, Al Jazeera, NPR, The Block.
Not affiliated with news agencies · automated digest
t.me/dayessence_en
```

5. **Avatar:** `brand/avatar.png`  
6. Add the same **Day Essence** bot as admin with **Post messages**  
7. `TELEGRAM_CHANNEL_ID_EN` = `@dayessence_en`

### Suggested pinned post (EN)

```
Welcome to World News · Day Essence.

Twice a day — a compact digest of the world’s most important events.
If a story catches your eye, follow the link to the original source.

📅 09:00 & 21:00 (Minsk)
🔗 Short summary + source link · t.me/dayessence_en
```

### Suggested pinned post

```
Добро пожаловать в «Мировые новости · Суть дня».

Два раза в сутки — сжатый дайджест важных мировых событий.
Если тема зацепила — переходите по ссылке к оригиналу.

📅 09:00 и 21:00 (Минск)
🔗 Краткое саммари + источник · t.me/dayessence_ru
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
