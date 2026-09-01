import { config } from "./config.js";
import { selectEvents } from "./eventSelection.js";
import { generateStories } from "./storyGeneration.js";
import { attachLongBodies } from "./longCopy.js";
import { publishTelegraphForTopStories } from "./telegraph.js";
import type { BilingualDigest, DigestResult, NewsItem } from "./types.js";
import type { Locale } from "./locale.js";
import type { SummarizeTelemetry } from "./telemetry.js";

export type SummarizeResult = {
  digest: BilingualDigest;
  telemetry: SummarizeTelemetry;
};

export function digestForLocale(
  digest: BilingualDigest,
  locale: Locale,
  storyLimit?: number,
): DigestResult {
  const stories = storyLimit ? digest.stories.slice(0, storyLimit) : digest.stories;
  return {
    locale,
    intro: telegramIntro()[locale],
    stories: stories.map((story) => ({
      link: story.link,
      source: story.source,
      title: story.title[locale],
      summary: story.summary[locale],
      category: story.category[locale],
      ...(story.longBody?.[locale] ? { longBody: story.longBody[locale] } : {}),
      ...(story.telegraphUrl?.[locale]
        ? { telegraphUrl: story.telegraphUrl[locale] }
        : {}),
    })),
  };
}

function digestIntro(storyCount: number): BilingualDigest["intro"] {
  return {
    ru: `Главные мировые события за последние несколько часов — ${storyCount} коротких новостей.`,
    en: `The latest major world events in ${storyCount} concise stories.`,
  };
}

/** Channel post intro — no Mini App story count. */
export function telegramIntro(): BilingualDigest["intro"] {
  return {
    ru: "Главные мировые события за последние несколько часов.",
    en: "The latest major world events from the past few hours.",
  };
}

export async function summarizeNews(
  items: NewsItem[],
  periodHours: number,
): Promise<SummarizeResult> {
  if (items.length < 1) {
    throw new Error("Need at least 1 news item in the window");
  }

  const selection = await selectEvents(items);
  const generated = await generateStories(selection.events);
  let stories = generated.stories;
  const calls = [...selection.calls, ...generated.calls];

  // Long briefings for Telegram top-N (also used by Mini App detail screens).
  const longResult = await attachLongBodies(stories, selection.events, config.topN);
  stories = longResult.stories;
  calls.push(...longResult.calls);

  if (!config.dryRun && config.telegraphAccessToken()) {
    stories = await publishTelegraphForTopStories(stories, config.topN);
  } else if (config.dryRun) {
    console.log("[telegraph] dry-run: skip createPage");
  } else {
    console.warn("[telegraph] TELEGRAPH_ACCESS_TOKEN missing; channel links stay on source URLs");
  }

  const digest: BilingualDigest = {
    intro: digestIntro(stories.length),
    stories,
  };

  console.log(
    `[summarize] ${items.length} URLs → ${selection.clusters.length} event clusters → ${selection.events.length} selected → ${stories.length} localized`,
  );

  return {
    digest,
    telemetry: {
      model: config.openaiModel,
      periodHours,
      poolSize: items.length,
      candidateCount: selection.candidates.length,
      maxStories: Math.min(selection.clusters.length, config.miniAppTopN),
      telegramTopN: config.topN,
      candidates: selection.candidates,
      clusters: selection.clusters,
      calls,
    },
  };
}
