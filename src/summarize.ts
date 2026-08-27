import { z } from "zod";
import { config } from "./config.js";
import { chatCompletionJson } from "./openai.js";
import type { BilingualDigest, DigestResult, NewsItem } from "./types.js";
import type { Locale } from "./locale.js";
import { LOCALES } from "./locale.js";

const StorySchema = z.object({
  title_ru: z.string(),
  title_en: z.string(),
  summary_ru: z.string(),
  summary_en: z.string(),
  link: z.string(),
  source: z.string(),
  category_ru: z.string(),
  category_en: z.string(),
});

function digestSchema(storyCount: number) {
  return z.object({
    intro_ru: z.string(),
    intro_en: z.string(),
    stories: z.array(StorySchema).length(storyCount),
  });
}

function buildPrompt(items: NewsItem[], targetCount: number, periodHours: number): string {
  const catalog = items.slice(0, 100).map((item, i) => ({
    i: i + 1,
    title: item.title,
    source: item.source,
    link: item.link,
    summary: item.summary,
    publishedAt: item.publishedAt?.toISOString() ?? null,
  }));

  const periodLabel =
    periodHours <= 8
      ? `the last ~${Math.round(periodHours)} hours since the previous briefing`
      : `roughly the last ${Math.round(periodHours)} hours since the previous briefing`;

  const telegramN = Math.min(config.topN, targetCount);

  return `You are the editor of a bilingual news digest for Telegram (Russian + English channels) and a Mini App. Published twice daily (06:00 and 18:00 UTC).

Step 1 — select **exactly ${targetCount}** stories (array length must be ${targetCount}), **ranked by importance** (most important first):
- Positions 1–${telegramN}: Telegram channel digest (headline set).
- Positions ${telegramN + 1}–${targetCount}: **additional** stories for the Mini App only — same ranking list continues; Mini App shows all ${targetCount} (Telegram stories + extras).
- You MUST fill all ${targetCount} slots. Prefer distinct events; merge true duplicates (same event, multiple outlets → one entry with the best source link), then keep filling with the next-most-important remaining catalog items until you reach exactly ${targetCount}.
- Weaker-but-real world news is OK for slots after ${telegramN}; do **not** leave the array short and do **not** invent stories or URLs.
- Prioritize for early slots: major geopolitics, conflicts, disasters, economy, science/health breakthroughs, landmark court/policy decisions.
- Deprioritize (use only if needed to reach ${targetCount}): celebrity gossip, minor sports, repetitive incremental updates of an event already listed.
- Every story must use a unique catalog \`link\` (no repeated URLs).

Catalog size: ${catalog.length} items from ${periodLabel}.

Step 2 — write BOTH language versions for each selected story:
- title_ru: headline fully in Russian (translate from English if needed; never leave English in title_ru).
- title_en: headline in clear English (may polish the original RSS title).
- summary_ru: 1–2 sentences in Russian, neutral tone, no clickbait.
- summary_en: 1–2 sentences in English, same facts as summary_ru.
- category_ru / category_en: short topic label (Politics, Economy, Tech, Science, Conflict, Society, etc.).
- link and source: copy exactly from the catalog — do not invent URLs.

Also write intro_ru (1 sentence, Russian) and intro_en (1 sentence, English).

Return ONLY valid JSON:
{
  "intro_ru": "...",
  "intro_en": "...",
  "stories": [
    {
      "title_ru": "...",
      "title_en": "...",
      "summary_ru": "...",
      "summary_en": "...",
      "link": "...",
      "source": "...",
      "category_ru": "...",
      "category_en": "..."
    }
  ]
}

Catalog:
${JSON.stringify(catalog, null, 2)}`;
}

function toBilingualDigest(parsed: z.infer<ReturnType<typeof digestSchema>>): BilingualDigest {
  return {
    intro: {
      ru: parsed.intro_ru,
      en: parsed.intro_en,
    },
    stories: parsed.stories.map((story) => ({
      link: story.link,
      source: story.source,
      title: { ru: story.title_ru, en: story.title_en },
      summary: { ru: story.summary_ru, en: story.summary_en },
      category: { ru: story.category_ru, en: story.category_en },
    })),
  };
}

export function digestForLocale(
  digest: BilingualDigest,
  locale: Locale,
  storyLimit?: number,
): DigestResult {
  const stories = storyLimit ? digest.stories.slice(0, storyLimit) : digest.stories;
  return {
    locale,
    intro: digest.intro[locale],
    stories: stories.map((story) => ({
      link: story.link,
      source: story.source,
      title: story.title[locale],
      summary: story.summary[locale],
      category: story.category[locale],
    })),
  };
}

export async function summarizeNews(items: NewsItem[], periodHours: number): Promise<BilingualDigest> {
  const targetCount = Math.min(items.length, config.miniAppTopN);

  if (targetCount < 1) {
    throw new Error("Need at least 1 news item in the window");
  }

  const allowedLinks = new Set(items.map((i) => i.link));
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await chatCompletionJson({
        model: config.openaiModel,
        temperature: attempt === 1 ? 0.3 : 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a precise news editor. Reply with JSON only. Do not invent facts or links. title_ru must always be Russian. The stories array must contain exactly ${targetCount} items with unique catalog links.`,
          },
          { role: "user", content: buildPrompt(items, targetCount, periodHours) },
        ],
      });

      const parsed = digestSchema(targetCount).parse(JSON.parse(raw));
      const stories = parsed.stories.filter((s) => allowedLinks.has(s.link));
      const uniqueLinks = new Set(stories.map((s) => s.link));

      if (stories.length !== targetCount || uniqueLinks.size !== targetCount) {
        throw new Error(
          `OpenAI returned ${stories.length} valid / ${uniqueLinks.size} unique links (expected exactly ${targetCount})`,
        );
      }

      return toBilingualDigest({ ...parsed, stories });
    } catch (error) {
      lastError = error;
      console.warn(`[summarize] attempt ${attempt}/${3} failed:`, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to produce exactly ${targetCount} stories after 3 attempts`);
}
