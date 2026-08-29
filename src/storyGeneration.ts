import { z } from "zod";
import { config } from "./config.js";
import { chatCompletionJson, type ChatJsonResult } from "./openai.js";
import type {
  BilingualStory,
  CategoryKey,
  RankedEvent,
} from "./types.js";
import {
  callTelemetry,
  errorMessage,
  rawPreview,
  type AiCallTelemetry,
} from "./telemetry.js";

const BATCH_SIZE = 10;

const GeneratedCopySchema = z.object({
  id: z.number().int(),
  title_ru: z.string(),
  title_en: z.string(),
  summary_ru: z.string(),
  summary_en: z.string(),
});

const GeneratedResponseSchema = z.object({
  stories: z.array(GeneratedCopySchema),
});

type GeneratedCopy = z.infer<typeof GeneratedCopySchema>;

const CATEGORY_LABELS: Record<CategoryKey, { ru: string; en: string }> = {
  conflict: { ru: "Конфликт", en: "Conflict" },
  politics: { ru: "Политика", en: "Politics" },
  economy: { ru: "Экономика", en: "Economy" },
  technology: { ru: "Технологии", en: "Technology" },
  science: { ru: "Наука", en: "Science" },
  health: { ru: "Здоровье", en: "Health" },
  climate: { ru: "Климат", en: "Climate" },
  disaster: { ru: "Катастрофа", en: "Disaster" },
  law: { ru: "Право", en: "Law" },
  society: { ru: "Общество", en: "Society" },
  culture: { ru: "Культура", en: "Culture" },
  sport: { ru: "Спорт", en: "Sport" },
  world: { ru: "Мир", en: "World" },
};

const responseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "localized_news_copy",
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
            required: ["id", "title_ru", "title_en", "summary_ru", "summary_en"],
            properties: {
              id: { type: "integer" },
              title_ru: { type: "string" },
              title_en: { type: "string" },
              summary_ru: { type: "string" },
              summary_en: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function buildPrompt(events: RankedEvent[]): string {
  const payload = events.map((event) => ({
    id: event.representativeIndex,
    source: event.representative.source,
    title: event.representative.title,
    summary: event.representative.summary,
    relatedHeadlines: event.members
      .filter((item) => item.link !== event.representative.link)
      .slice(0, 4)
      .map((item) => item.title),
  }));

  return `Write concise bilingual copy for every event below. Selection and order are already final.

Rules:
- Return exactly one object for each input id; preserve ids.
- title_ru must be fully Russian; title_en must be clear English.
- summary_ru and summary_en: 1–2 short factual sentences with the same facts.
- Use only supplied facts. Do not add links, sources, categories, or commentary.
- Related headlines are context for the same event, not separate stories.

Events:
${JSON.stringify(payload)}`;
}

async function requestCopies(
  events: RankedEvent[],
  attempt: number,
  calls: AiCallTelemetry[],
): Promise<GeneratedCopy[]> {
  let content = "";
  let result: ChatJsonResult | undefined;
  try {
    result = await chatCompletionJson({
      model: config.openaiModel,
      temperature: 0.25,
      max_completion_tokens: 4_000,
      response_format: responseFormat,
      messages: [
        {
          role: "system",
          content:
            "You are a concise bilingual news copy editor. Return only the requested JSON. Never omit an input id.",
        },
        { role: "user", content: buildPrompt(events) },
      ],
    });
    content = result.content;
    const parsed = GeneratedResponseSchema.parse(JSON.parse(content));
    const allowedIds = new Set(events.map((event) => event.representativeIndex));
    const seen = new Set<number>();
    const accepted = parsed.stories.filter((story) => {
      if (!allowedIds.has(story.id) || seen.has(story.id)) return false;
      seen.add(story.id);
      return true;
    });
    calls.push(
      callTelemetry("localize", attempt, result, {
        returnedCount: parsed.stories.length,
        acceptedCount: accepted.length,
      }),
    );
    return accepted;
  } catch (error) {
    calls.push(
      result
        ? {
            ...callTelemetry("localize", attempt, result),
            ok: false,
            error: errorMessage(error),
            ...(content ? { rawPreview: rawPreview(content) } : {}),
          }
        : {
            stage: "localize",
            attempt,
            ok: false,
            error: errorMessage(error),
            ...(content ? { rawPreview: rawPreview(content) } : {}),
          },
    );
    console.warn(`[localize] attempt ${attempt} failed:`, error);
    return [];
  }
}

function toStory(event: RankedEvent, copy: GeneratedCopy): BilingualStory {
  const category = CATEGORY_LABELS[event.category];
  return {
    link: event.representative.link,
    source: event.representative.source,
    title: { ru: copy.title_ru, en: copy.title_en },
    summary: { ru: copy.summary_ru, en: copy.summary_en },
    category,
  };
}

export async function generateStories(
  events: RankedEvent[],
): Promise<{ stories: BilingualStory[]; calls: AiCallTelemetry[] }> {
  const copies = new Map<number, GeneratedCopy>();
  const calls: AiCallTelemetry[] = [];
  let callNumber = 0;

  for (let offset = 0; offset < events.length; offset += BATCH_SIZE) {
    const batch = events.slice(offset, offset + BATCH_SIZE);
    const first = await requestCopies(batch, ++callNumber, calls);
    for (const copy of first) copies.set(copy.id, copy);

    const missing = batch.filter((event) => !copies.has(event.representativeIndex));
    if (missing.length > 0) {
      console.warn(
        `[localize] batch ${offset / BATCH_SIZE + 1}: retrying ${missing.length} missing stories`,
      );
      const retry = await requestCopies(missing, ++callNumber, calls);
      for (const copy of retry) copies.set(copy.id, copy);
    }
  }

  const stories = events.flatMap((event) => {
    const copy = copies.get(event.representativeIndex);
    return copy ? [toStory(event, copy)] : [];
  });

  if (stories.length < 1) {
    throw new Error("Failed to generate localized copy for any selected event");
  }
  if (stories.length < events.length) {
    console.warn(
      `[localize] generated ${stories.length}/${events.length} stories (publishing successful batches)`,
    );
  }

  return { stories, calls };
}
