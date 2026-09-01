import { z } from "zod";
import { config } from "./config.js";
import { chatCompletionJson, type ChatJsonResult } from "./openai.js";
import type { BilingualStory, RankedEvent } from "./types.js";
import {
  callTelemetry,
  errorMessage,
  rawPreview,
  type AiCallTelemetry,
} from "./telemetry.js";

const BATCH_SIZE = 10;

const LongCopySchema = z.object({
  id: z.number().int(),
  long_ru: z.string(),
  long_en: z.string(),
});

const LongResponseSchema = z.object({
  stories: z.array(LongCopySchema),
});

const responseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "long_news_copy",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["stories"],
      properties: {
        stories: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "long_ru", "long_en"],
            properties: {
              id: { type: "integer" },
              long_ru: { type: "string" },
              long_en: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function buildPrompt(
  events: RankedEvent[],
  stories: BilingualStory[],
  idOffset: number,
): string {
  const byLink = new Map(stories.map((story) => [story.link, story]));
  const payload = events.map((event, index) => {
    const story = byLink.get(event.representative.link);
    return {
      id: idOffset + index,
      source: event.representative.source,
      title: story?.title.en ?? event.representative.title,
      short_ru: story?.summary.ru ?? "",
      short_en: story?.summary.en ?? "",
      rssSummary: event.representative.summary,
      relatedHeadlines: event.members
        .filter((item) => item.link !== event.representative.link)
        .slice(0, 4)
        .map((item) => item.title),
    };
  });

  return `Write a longer bilingual briefing for each news event below. This is an editorial paraphrase / brief, NOT a full reprint of any article.

Rules:
- Return exactly one object for each input id; preserve ids.
- long_ru and long_en: 3–5 short paragraphs separated by blank lines (\\n\\n). Same facts in both languages.
- Use only supplied facts (short summaries, RSS snippet, related headlines). Do not invent quotes, numbers, or outcomes.
- No links, hashtags, or source names inside the body (source is shown separately).
- Keep a calm factual tone.

Events:
${JSON.stringify(payload)}`;
}

async function requestLongBodies(
  events: RankedEvent[],
  stories: BilingualStory[],
  idOffset: number,
  attempt: number,
  calls: AiCallTelemetry[],
): Promise<Map<number, { long_ru: string; long_en: string }>> {
  const accepted = new Map<number, { long_ru: string; long_en: string }>();
  let content = "";
  let result: ChatJsonResult | undefined;

  try {
    result = await chatCompletionJson({
      model: config.openaiModel,
      temperature: 0.3,
      max_completion_tokens: 6_000,
      response_format: responseFormat,
      messages: [
        {
          role: "system",
          content:
            "You write concise bilingual news briefings. Return only the requested JSON. Never omit an input id.",
        },
        { role: "user", content: buildPrompt(events, stories, idOffset) },
      ],
    });
    content = result.content;
    const parsed = LongResponseSchema.parse(JSON.parse(content));
    const allowedIds = new Set(events.map((_, index) => idOffset + index));

    for (const row of parsed.stories) {
      if (!allowedIds.has(row.id) || !row.long_ru?.trim() || !row.long_en?.trim()) continue;
      accepted.set(row.id, { long_ru: row.long_ru.trim(), long_en: row.long_en.trim() });
    }

    calls.push(
      callTelemetry("longCopy", attempt, result, {
        returnedCount: parsed.stories.length,
        acceptedCount: accepted.size,
      }),
    );
  } catch (error) {
    calls.push(
      result
        ? {
            ...callTelemetry("longCopy", attempt, result),
            ok: false,
            error: errorMessage(error),
            ...(content ? { rawPreview: rawPreview(content) } : {}),
          }
        : {
            stage: "longCopy",
            attempt,
            ok: false,
            error: errorMessage(error),
            ...(content ? { rawPreview: rawPreview(content) } : {}),
          },
    );
    console.warn(`[longCopy] batch at offset ${idOffset} failed:`, error);
  }

  return accepted;
}

/**
 * Attach longBody to the first `limit` stories (Mini App + Telegraph) using RankedEvent context.
 */
export async function attachLongBodies(
  stories: BilingualStory[],
  events: RankedEvent[],
  limit = config.miniAppTopN,
): Promise<{ stories: BilingualStory[]; calls: AiCallTelemetry[] }> {
  const count = Math.min(limit, stories.length);
  const targetStories = stories.slice(0, count);
  const eventByLink = new Map(events.map((event) => [event.representative.link, event]));
  const copies = new Map<number, { long_ru: string; long_en: string }>();
  const calls: AiCallTelemetry[] = [];
  let callNumber = 0;

  for (let offset = 0; offset < count; offset += BATCH_SIZE) {
    const batchStories = targetStories.slice(offset, offset + BATCH_SIZE);
    const batchEvents = batchStories
      .map((story) => eventByLink.get(story.link))
      .filter((event): event is RankedEvent => Boolean(event));

    if (batchEvents.length < 1) continue;

    const batch = await requestLongBodies(
      batchEvents,
      batchStories,
      offset,
      ++callNumber,
      calls,
    );
    for (const [id, copy] of batch) copies.set(id, copy);
  }

  const enriched = stories.map((story, index) => {
    if (index >= count) return story;
    const copy = copies.get(index);
    if (!copy) return story;
    return {
      ...story,
      longBody: { ru: copy.long_ru, en: copy.long_en },
    };
  });

  const accepted = enriched.filter((s, i) => i < count && s.longBody).length;
  console.log(`[longCopy] attached longBody to ${accepted}/${count} stories`);
  return { stories: enriched, calls };
}
