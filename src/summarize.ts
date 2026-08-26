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

function digestSchema(topN: number) {
  return z.object({
    intro_ru: z.string(),
    intro_en: z.string(),
    stories: z.array(StorySchema).length(topN),
  });
}

function buildPrompt(items: NewsItem[], topN: number, periodHours: number): string {
  const catalog = items.slice(0, 80).map((item, i) => ({
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

  return `You are the editor of a bilingual news digest for Telegram (Russian + English channels). Published twice daily (06:00 and 18:00 UTC).

Step 1 — select **exactly ${topN}** stories (the array must have length ${topN}, never fewer):
- Pick the ${topN} most important and publicly significant world news from ${periodLabel}.
- If fewer than ${topN} major breaking stories exist, fill remaining slots with the next-most-important items from the catalog — still exactly ${topN} entries.
- Merge duplicates (same event from multiple outlets → one entry; prefer the most authoritative source link).
- Prioritize: major geopolitics, conflicts, disasters, economy, science/health breakthroughs, landmark court/policy decisions.
- Deprioritize: celebrity gossip, minor sports, repetitive incremental updates.

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

export function digestForLocale(digest: BilingualDigest, locale: Locale): DigestResult {
  return {
    locale,
    intro: digest.intro[locale],
    stories: digest.stories.map((story) => ({
      link: story.link,
      source: story.source,
      title: story.title[locale],
      summary: story.summary[locale],
      category: story.category[locale],
    })),
  };
}

export async function summarizeNews(items: NewsItem[], periodHours: number): Promise<BilingualDigest> {
  const topN = config.topN;

  if (items.length < topN) {
    throw new Error(`Need at least ${topN} news items in the window, got ${items.length}`);
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
            content: `You are a precise news editor. Reply with JSON only. Do not invent facts or links. title_ru must always be Russian. The stories array must contain exactly ${topN} items.`,
          },
          { role: "user", content: buildPrompt(items, topN, periodHours) },
        ],
      });

      const parsed = digestSchema(topN).parse(JSON.parse(raw));
      const stories = parsed.stories.filter((s) => allowedLinks.has(s.link));

      if (stories.length !== topN) {
        throw new Error(`OpenAI returned ${stories.length}/${topN} stories with valid links`);
      }

      return toBilingualDigest({ ...parsed, stories });
    } catch (error) {
      lastError = error;
      console.warn(`[summarize] attempt ${attempt}/${3} failed:`, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Failed to produce exactly ${topN} stories after 3 attempts`);
}
