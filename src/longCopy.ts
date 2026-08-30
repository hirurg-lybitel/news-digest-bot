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

function buildPrompt(events: RankedEvent[], stories: BilingualStory[]): string {
  const byLink = new Map(stories.map((story) => [story.link, story]));
  const payload = events.map((event, index) => {
    const story = byLink.get(event.representative.link);
    return {
      id: index,
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

/**
 * Attach longBody to the first `limit` stories (Telegram top-N) using RankedEvent context.
 */
export async function attachLongBodies(
  stories: BilingualStory[],
  events: RankedEvent[],
  limit = config.topN,
): Promise<{ stories: BilingualStory[]; calls: AiCallTelemetry[] }> {
  const targetStories = stories.slice(0, limit);
  const eventByLink = new Map(events.map((event) => [event.representative.link, event]));
  const targetEvents = targetStories
    .map((story) => eventByLink.get(story.link))
    .filter((event): event is RankedEvent => Boolean(event));

  if (targetEvents.length < 1) {
    return { stories, calls: [] };
  }

  const calls: AiCallTelemetry[] = [];
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
        { role: "user", content: buildPrompt(targetEvents, targetStories) },
      ],
    });
    content = result.content;
    const parsed = LongResponseSchema.parse(JSON.parse(content));
    const byId = new Map(parsed.stories.map((row) => [row.id, row]));

    const enriched = stories.map((story, index) => {
      if (index >= limit) return story;
      const row = byId.get(index);
      if (!row?.long_ru?.trim() || !row.long_en?.trim()) return story;
      return {
        ...story,
        longBody: { ru: row.long_ru.trim(), en: row.long_en.trim() },
      };
    });

    const accepted = enriched.filter((s, i) => i < limit && s.longBody).length;
    calls.push(
      callTelemetry("longCopy", 1, result, {
        returnedCount: parsed.stories.length,
        acceptedCount: accepted,
      }),
    );

    console.log(`[longCopy] attached longBody to ${accepted}/${limit} telegram stories`);
    return { stories: enriched, calls };
  } catch (error) {
    calls.push(
      result
        ? {
            ...callTelemetry("longCopy", 1, result),
            ok: false,
            error: errorMessage(error),
            ...(content ? { rawPreview: rawPreview(content) } : {}),
          }
        : {
            stage: "longCopy",
            attempt: 1,
            ok: false,
            error: errorMessage(error),
            ...(content ? { rawPreview: rawPreview(content) } : {}),
          },
    );
    console.warn("[longCopy] failed; continuing without long bodies:", error);
    return { stories, calls };
  }
}
