import { config } from "./config.js";
import type { BilingualStory } from "./types.js";
import type { Locale } from "./locale.js";
import { LOCALES } from "./locale.js";

const TELEGRAPH_API = "https://api.telegra.ph";

type TelegraphNode =
  | string
  | {
      tag: string;
      attrs?: Record<string, string>;
      children?: TelegraphNode[];
    };

type TelegraphApiResponse<T> = {
  ok: boolean;
  result?: T;
  error?: string;
};

type TelegraphPage = {
  path: string;
  url: string;
  title: string;
};

function paragraphsToNodes(text: string): TelegraphNode[] {
  return text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({
      tag: "p",
      children: [part],
    }));
}

function buildContent(
  longBody: string,
  source: string,
  originalUrl: string,
  locale: Locale,
): TelegraphNode[] {
  const sourceLabel = locale === "ru" ? "Источник" : "Source";
  return [
    ...paragraphsToNodes(longBody),
    { tag: "hr" },
    {
      tag: "p",
      children: [
        `${sourceLabel}: ${source} — `,
        {
          tag: "a",
          attrs: { href: originalUrl },
          children: [locale === "ru" ? "оригинал" : "original"],
        },
      ],
    },
  ];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function floodWaitSeconds(error: string | undefined): number | null {
  if (!error) return null;
  const match = error.match(/FLOOD_WAIT_(\d+)/);
  return match ? Number(match[1]) : null;
}

async function createPage(params: {
  title: string;
  authorName: string;
  content: TelegraphNode[];
}): Promise<string | undefined> {
  const token = config.telegraphAccessToken();
  if (!token) {
    console.warn("[telegraph] TELEGRAPH_ACCESS_TOKEN missing; skip page create");
    return undefined;
  }

  const maxAttempts = 4;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`${TELEGRAPH_API}/createPage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        title: params.title.slice(0, 256),
        author_name: params.authorName.slice(0, 128),
        content: params.content,
        return_content: false,
      }),
    });

    const body = (await response.json()) as TelegraphApiResponse<TelegraphPage>;
    if (response.ok && body.ok && body.result?.url) {
      return body.result.url;
    }

    const waitSec = floodWaitSeconds(body.error);
    if (waitSec != null && attempt < maxAttempts) {
      const delayMs = (waitSec + 1) * 1_000;
      console.warn(
        `[telegraph] createPage rate-limited (${body.error}); retry ${attempt}/${maxAttempts - 1} in ${waitSec + 1}s`,
      );
      await sleep(delayMs);
      continue;
    }

    console.warn(
      `[telegraph] createPage failed: ${body.error ?? response.statusText}`,
    );
    return undefined;
  }

  return undefined;
}

/**
 * Publish Telegraph pages for Telegram top-N stories (both locales).
 */
export async function publishTelegraphForTopStories(
  stories: BilingualStory[],
  limit = config.topN,
): Promise<BilingualStory[]> {
  const count = Math.min(limit, stories.length);
  const updated = [...stories];

  for (let i = 0; i < count; i++) {
    const story = updated[i];
    if (!story?.longBody) continue;

    const telegraphUrl: Partial<Record<Locale, string>> = {
      ...(story.telegraphUrl ?? {}),
    };

    for (const locale of LOCALES) {
      const body = story.longBody[locale];
      const title = story.title[locale];
      if (!body?.trim() || !title?.trim()) continue;

      const url = await createPage({
        title,
        authorName: locale === "ru" ? "Суть дня" : "Day Essence",
        content: buildContent(body, story.source, story.link, locale),
      });
      if (url) telegraphUrl[locale] = url;
      await sleep(1_200);
    }

    if (telegraphUrl.ru || telegraphUrl.en) {
      updated[i] = {
        ...story,
        telegraphUrl: {
          ru: telegraphUrl.ru ?? story.link,
          en: telegraphUrl.en ?? story.link,
        },
      };
    }
  }

  const published = updated
    .slice(0, count)
    .filter((s) => s.telegraphUrl?.ru || s.telegraphUrl?.en).length;
  console.log(`[telegraph] published pages for ${published}/${count} stories`);
  return updated;
}
