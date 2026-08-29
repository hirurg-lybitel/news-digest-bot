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

type StoryDraft = z.infer<typeof StorySchema>;

function digestSchema(maxStories: number) {
  return z.object({
    intro_ru: z.string(),
    intro_en: z.string(),
    stories: z.array(StorySchema).min(1).max(maxStories),
  });
}

function fillSchema(need: number) {
  return z.object({
    stories: z.array(StorySchema).min(1).max(need),
  });
}

function catalogPayload(items: NewsItem[]) {
  return items.slice(0, 100).map((item, i) => ({
    i: i + 1,
    title: item.title,
    source: item.source,
    link: item.link,
    summary: item.summary,
    publishedAt: item.publishedAt?.toISOString() ?? null,
  }));
}

function periodLabel(periodHours: number): string {
  return periodHours <= 8
    ? `the last ~${Math.round(periodHours)} hours since the previous briefing`
    : `roughly the last ${Math.round(periodHours)} hours since the previous briefing`;
}

/** Soft floor: retry if model returns fewer than this when the pool is large enough. */
function minAcceptableCount(maxStories: number, poolSize: number): number {
  if (poolSize < config.topN) return 1;
  if (poolSize < 20) return Math.min(maxStories, Math.max(config.topN, poolSize));
  // e.g. max 30 → require at least 20 before giving up on retries
  return Math.min(maxStories, Math.max(20, Math.ceil(maxStories * 0.67)));
}

function buildPrompt(items: NewsItem[], maxStories: number, periodHours: number): string {
  const catalog = catalogPayload(items);
  const telegramN = Math.min(config.topN, maxStories);

  return `You are the editor of a bilingual news digest for Telegram (Russian + English channels) and a Mini App. Published twice daily (06:00 and 18:00 UTC).

Step 1 — select stories, **ranked by importance** (most important first):
- Target length: **${maxStories}** stories. The catalog has ${catalog.length} items from ${periodLabel(periodHours)}.
- Do **NOT** stop at ${telegramN}. Positions 1–${telegramN} are only the Telegram headline set; positions ${telegramN + 1}–${maxStories} are required Mini App extras from **other** distinct events.
- Returning only ~${telegramN} stories when the catalog is large is a failure. Fill toward ${maxStories}.
- Fewer than ${maxStories} is allowed **only** after aggressive event-level dedup leaves no more distinct events — not because you decided "10 is enough".

**Hard dedup (same real-world event = one story):**
- One disaster, conflict, election, court ruling, market move, or policy decision → **exactly one** entry.
- Merge breaking / explainers / science / video / live / "what caused X" for the same event.
- Prefer the most authoritative / informative catalog link.
- After merging, keep adding **other** distinct events (including weaker-but-real world news) until ${maxStories} or the catalog is exhausted.
- Unique catalog \`link\` per story; no two entries a reader would see as the same news.

- Prioritize early slots: geopolitics, conflicts, disasters, economy, science/health, landmark court/policy.
- Later Mini App slots may include secondary world news; still avoid pure celebrity gossip / minor sports unless needed to fill.

Step 2 — write BOTH language versions for each selected story:
- title_ru: fully Russian (never leave English in title_ru).
- title_en: clear English.
- summary_ru / summary_en: 1–2 sentences, same facts, neutral tone.
- category_ru / category_en: short topic label.
- link and source: copy exactly from the catalog — do not invent URLs.

Also write intro_ru and intro_en (1 sentence each).

Return ONLY valid JSON:
{
  "intro_ru": "...",
  "intro_en": "...",
  "stories": [ { "title_ru": "...", "title_en": "...", "summary_ru": "...", "summary_en": "...", "link": "...", "source": "...", "category_ru": "...", "category_en": "..." } ]
}

Catalog:
${JSON.stringify(catalog, null, 2)}`;
}

function buildFillPrompt(
  remainingItems: NewsItem[],
  need: number,
  alreadySelected: StoryDraft[],
): string {
  const catalog = catalogPayload(remainingItems);
  const taken = alreadySelected.map((s) => ({ title_en: s.title_en, link: s.link, source: s.source }));

  return `You are filling a Mini App news list. Already selected ${alreadySelected.length} distinct events. Add **up to ${need} more** from the remaining catalog (aim for ${need}).

Rules:
- Only use links from the remaining catalog below.
- Do not repeat any already-selected event (see list). Skip same-event explainers/videos/updates.
- Weaker-but-real world news is OK — this is the Mini App overflow, not the Telegram top ${config.topN}.
- Unique links; bilingual fields as usual (title_ru must be Russian).
- link/source exact from catalog.

Already selected (do not duplicate):
${JSON.stringify(taken, null, 2)}

Remaining catalog:
${JSON.stringify(catalog, null, 2)}

Return ONLY JSON: { "stories": [ ... ] }`;
}

function toBilingualDigest(
  intro: { ru: string; en: string },
  stories: StoryDraft[],
): BilingualDigest {
  return {
    intro,
    stories: stories.map((story) => ({
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
  stories: StoryDraft[],
  allowedLinks: Set<string>,
  maxStories: number,
  excludeLinks?: Set<string>,
): StoryDraft[] {
  const seen = new Set<string>(excludeLinks);
  const out: StoryDraft[] = [];
  for (const story of stories) {
    if (!allowedLinks.has(story.link) || seen.has(story.link)) continue;
    seen.add(story.link);
    out.push(story);
    if (out.length >= maxStories) break;
  }
  return out;
}

async function selectInitial(
  items: NewsItem[],
  maxStories: number,
  periodHours: number,
  allowedLinks: Set<string>,
  minAcceptable: number,
): Promise<{ intro_ru: string; intro_en: string; stories: StoryDraft[] }> {
  let lastError: unknown;
  let best: { intro_ru: string; intro_en: string; stories: StoryDraft[] } | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await chatCompletionJson({
        model: config.openaiModel,
        temperature: attempt === 1 ? 0.35 : 0.25,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are a precise news editor. JSON only. Do not invent facts or links. title_ru must be Russian. Return as close to ${maxStories} distinct-event stories as the catalog allows — never stop at ${config.topN} when more distinct events remain.`,
          },
          { role: "user", content: buildPrompt(items, maxStories, periodHours) },
        ],
      });

      const parsed = digestSchema(maxStories).parse(JSON.parse(raw));
      const stories = uniqueValidStories(parsed.stories, allowedLinks, maxStories);

      if (stories.length < 1) {
        throw new Error("OpenAI returned no stories with valid catalog links");
      }

      const candidate = {
        intro_ru: parsed.intro_ru,
        intro_en: parsed.intro_en,
        stories,
      };

      if (!best || stories.length > best.stories.length) {
        best = candidate;
      }

      if (stories.length >= minAcceptable) {
        return candidate;
      }

      throw new Error(
        `Too few stories: ${stories.length}/${maxStories} (need ≥${minAcceptable} before fill pass)`,
      );
    } catch (error) {
      lastError = error;
      console.warn(`[summarize] select attempt ${attempt}/3 failed:`, error);
    }
  }

  if (best && best.stories.length >= 1) {
    console.warn(
      `[summarize] proceeding with best select result ${best.stories.length}/${maxStories}`,
    );
    return best;
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to select digest stories after 3 attempts");
}

async function fillMoreStories(
  items: NewsItem[],
  already: StoryDraft[],
  maxStories: number,
  allowedLinks: Set<string>,
): Promise<StoryDraft[]> {
  const need = maxStories - already.length;
  if (need <= 0) return [];

  const taken = new Set(already.map((s) => s.link));
  const remaining = items.filter((item) => !taken.has(item.link));
  if (remaining.length < 1) return [];

  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw = await chatCompletionJson({
        model: config.openaiModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `JSON only. Add up to ${need} more distinct Mini App stories from the remaining catalog. title_ru must be Russian. Do not invent links.`,
          },
          { role: "user", content: buildFillPrompt(remaining, need, already) },
        ],
      });

      const parsed = fillSchema(need).parse(JSON.parse(raw));
      const added = uniqueValidStories(parsed.stories, allowedLinks, need, taken);
      if (added.length < 1) {
        throw new Error("Fill pass returned no new valid stories");
      }
      return added;
    } catch (error) {
      lastError = error;
      console.warn(`[summarize] fill attempt ${attempt}/2 failed:`, error);
    }
  }

  console.warn(`[summarize] fill pass skipped:`, lastError);
  return [];
}

export async function summarizeNews(items: NewsItem[], periodHours: number): Promise<BilingualDigest> {
  const maxStories = Math.min(items.length, config.miniAppTopN);

  if (maxStories < 1) {
    throw new Error("Need at least 1 news item in the window");
  }

  const allowedLinks = new Set(items.map((i) => i.link));
  const minAcceptable = minAcceptableCount(maxStories, items.length);

  const selected = await selectInitial(
    items,
    maxStories,
    periodHours,
    allowedLinks,
    minAcceptable,
  );

  let stories = selected.stories;

  if (stories.length < maxStories) {
    console.warn(
      `[summarize] ${stories.length}/${maxStories} after select — running fill pass`,
    );
    const extra = await fillMoreStories(items, stories, maxStories, allowedLinks);
    stories = [...stories, ...extra].slice(0, maxStories);
  }

  if (stories.length < maxStories) {
    console.warn(
      `[summarize] final ${stories.length}/${maxStories} stories (publishing what we have)`,
    );
  } else {
    console.log(`[summarize] filled ${stories.length}/${maxStories} stories`);
  }

  return toBilingualDigest(
    { ru: selected.intro_ru, en: selected.intro_en },
    stories,
  );
}
