import { z } from "zod";
import { config } from "./config.js";
import { chatCompletionJson } from "./openai.js";
import type { BilingualDigest, DigestResult, NewsItem } from "./types.js";
import type { Locale } from "./locale.js";

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

function digestSchema(maxStories: number) {
  return z.object({
    intro_ru: z.string(),
    intro_en: z.string(),
    stories: z.array(StorySchema).min(1).max(maxStories),
  });
}

function buildPrompt(items: NewsItem[], maxStories: number, periodHours: number): string {
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

  const telegramN = Math.min(config.topN, maxStories);

  return `You are the editor of a bilingual news digest for Telegram (Russian + English channels) and a Mini App. Published twice daily (06:00 and 18:00 UTC).

Step 1 — select **up to ${maxStories}** stories, **ranked by importance** (most important first):
- Aim for ${maxStories} when the catalog has enough **distinct events**; fewer is OK after merging duplicates — never invent stories or URLs.
- Positions 1–${telegramN}: Telegram channel digest (headline set).
- Positions ${telegramN + 1} onward: **additional** stories for the Mini App — same ranked list; Mini App shows Telegram stories + extras.

**Hard dedup (same real-world event = one story):**
- One disaster, conflict, election, court ruling, market move, or policy decision → **exactly one** entry, even if many outlets cover it.
- Merge across formats and angles: breaking news, explainers, science background, video packages, live blogs, death-toll updates, "what caused X" features — if they refer to the **same underlying event**, keep only one.
- Example: Nepal/Tibet flash floods covered by a DW science explainer and a BBC "what caused the floods" video → **one** story, not two.
- Prefer the most authoritative / most informative catalog link (full article over short video when both exist; otherwise the clearest primary report).
- After merging, fill remaining slots with **other** distinct events until you reach ${maxStories} or run out.
- Every selected story must use a unique catalog \`link\` (no repeated URLs). Do not list two stories that a reader would recognize as the same news.

- Weaker-but-real world news is OK for Mini App slots after ${telegramN}.
- Prioritize for early slots: major geopolitics, conflicts, disasters, economy, science/health breakthroughs, landmark court/policy decisions.
- Deprioritize (use only if needed to fill toward ${maxStories}): celebrity gossip, minor sports, repetitive incremental updates of an event already listed.

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

function uniqueValidStories(
  stories: z.infer<typeof StorySchema>[],
  allowedLinks: Set<string>,
  maxStories: number,
): z.infer<typeof StorySchema>[] {
  const seen = new Set<string>();
  const out: z.infer<typeof StorySchema>[] = [];
  for (const story of stories) {
    if (!allowedLinks.has(story.link) || seen.has(story.link)) continue;
    seen.add(story.link);
    out.push(story);
    if (out.length >= maxStories) break;
  }
  return out;
}

export async function summarizeNews(items: NewsItem[], periodHours: number): Promise<BilingualDigest> {
  const maxStories = Math.min(items.length, config.miniAppTopN);

  if (maxStories < 1) {
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
            content: `You are a precise news editor. Reply with JSON only. Do not invent facts or links. title_ru must always be Russian. Aim for up to ${maxStories} stories with unique catalog links. Same real-world event must appear only once (merge explainers/videos/updates with the main report). Fewer stories is acceptable after deduplication.`,
          },
          { role: "user", content: buildPrompt(items, maxStories, periodHours) },
        ],
      });

      const parsed = digestSchema(maxStories).parse(JSON.parse(raw));
      const stories = uniqueValidStories(parsed.stories, allowedLinks, maxStories);

      if (stories.length < 1) {
        throw new Error("OpenAI returned no stories with valid catalog links");
      }

      if (stories.length < maxStories) {
        console.warn(
          `[summarize] got ${stories.length}/${maxStories} stories (publishing what we have)`,
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
    : new Error(`Failed to produce digest stories after 3 attempts`);
}
