import { config } from "./config.js";
import { selectEvents } from "./eventSelection.js";
import { generateStories } from "./storyGeneration.js";
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

function digestIntro(storyCount: number): BilingualDigest["intro"] {
  return {
    ru: `Главные мировые события за последние несколько часов — ${storyCount} коротких новостей.`,
    en: `The latest major world events in ${storyCount} concise stories.`,
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
  const digest: BilingualDigest = {
    intro: digestIntro(generated.stories.length),
    stories: generated.stories,
  };

  console.log(
    `[summarize] ${items.length} URLs → ${selection.clusters.length} event clusters → ${selection.events.length} selected → ${generated.stories.length} localized`,
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
      calls: [...selection.calls, ...generated.calls],
    },
  };
}
