import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { NEWS_SOURCES } from "./sources.js";
import type { NewsItem } from "./types.js";

const parser = new Parser({
  timeout: 20_000,
  headers: {
    "User-Agent": "news-digest-bot/1.0 (+https://github.com/hirurg-lybitel/news-digest-bot)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
});

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId(link: string, title: string): string {
  return createHash("sha1").update(`${link}|${title}`).digest("hex").slice(0, 16);
}

function withinLookback(date: Date | null, lookbackHours: number): boolean {
  if (!date || Number.isNaN(date.getTime())) {
    // Если даты нет — оставляем: лучше чуть больше шума, чем потерять новость.
    return true;
  }
  const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;
  return date.getTime() >= cutoff;
}

export async function fetchNews(lookbackHours: number): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    NEWS_SOURCES.map(async (source) => {
      const feed = await parser.parseURL(source.url);
      return (feed.items ?? []).map((item): NewsItem => {
        const title = stripHtml(item.title ?? "").slice(0, 300);
        const link = (item.link ?? item.guid ?? "").trim();
        const summary = stripHtml(item.contentSnippet ?? item.content ?? item.summary ?? "").slice(
          0,
          600,
        );
        const publishedAt = item.isoDate
          ? new Date(item.isoDate)
          : item.pubDate
            ? new Date(item.pubDate)
            : null;

        return {
          id: makeId(link || title, title),
          title,
          link,
          source: source.name,
          summary,
          publishedAt,
        };
      });
    }),
  );

  const items: NewsItem[] = [];
  for (const [index, result] of results.entries()) {
    const source = NEWS_SOURCES[index]!;
    if (result.status === "rejected") {
      console.warn(`[fetch] ${source.name}: ${result.reason}`);
      continue;
    }
    items.push(...result.value);
    console.log(`[fetch] ${source.name}: ${result.value.length} items`);
  }

  const seen = new Set<string>();
  const deduped: NewsItem[] = [];

  for (const item of items) {
    if (!item.title || !item.link) continue;
    if (!withinLookback(item.publishedAt, lookbackHours)) continue;

    const key = item.link.replace(/#.*$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => {
    const at = a.publishedAt?.getTime() ?? 0;
    const bt = b.publishedAt?.getTime() ?? 0;
    return bt - at;
  });

  return deduped;
}
