import OpenAI from "openai";
import { z } from "zod";
import { config } from "./config.js";
import type { DigestResult, NewsItem } from "./types.js";

const DigestSchema = z.object({
  intro: z.string(),
  stories: z
    .array(
      z.object({
        title: z.string(),
        summary: z.string(),
        link: z.string(),
        source: z.string(),
        category: z.string(),
      }),
    )
    .min(1),
});

function buildPrompt(items: NewsItem[], topN: number): string {
  const catalog = items.slice(0, 80).map((item, i) => ({
    i: i + 1,
    title: item.title,
    source: item.source,
    link: item.link,
    summary: item.summary,
    publishedAt: item.publishedAt?.toISOString() ?? null,
  }));

  return `Ты редактор ежедневного новостного дайджеста для Telegram-канала на русском языке.

Задача:
1. Выбери ${topN} самых важных и общественно значимых новостей за последние сутки.
2. Избегай дублей (одна и та же история из разных агентств — одна запись, предпочти ссылку самого авторитетного источника).
3. Для каждой новости напиши краткое саммари на русском: 1–2 предложения, без кликбейта.
4. Сохрани исходный link и source из каталога (не выдумывай URL).
5. Добавь короткую категорию (например: Политика, Экономика, Технологии, Наука, Конфликт, Общество).
6. Напиши короткое intro (1 предложение) к дайджесту на русском.

Верни ТОЛЬКО валидный JSON вида:
{
  "intro": "...",
  "stories": [
    { "title": "...", "summary": "...", "link": "...", "source": "...", "category": "..." }
  ]
}

Каталог новостей:
${JSON.stringify(catalog, null, 2)}`;
}

export async function summarizeNews(items: NewsItem[]): Promise<DigestResult> {
  if (items.length === 0) {
    throw new Error("No news items to summarize");
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey() });
  const topN = Math.min(config.topN, items.length);

  const completion = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Ты точный новостной редактор. Отвечаешь только JSON. Не выдумываешь факты и ссылки.",
      },
      { role: "user", content: buildPrompt(items, topN) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty OpenAI response");
  }

  const parsed = DigestSchema.parse(JSON.parse(raw));
  const allowedLinks = new Set(items.map((i) => i.link));

  const stories = parsed.stories
    .filter((s) => allowedLinks.has(s.link))
    .slice(0, topN);

  if (stories.length === 0) {
    throw new Error("OpenAI returned stories with unknown links");
  }

  return { intro: parsed.intro, stories };
}
