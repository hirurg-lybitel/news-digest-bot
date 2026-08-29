import { config } from "./config.js";
import { fetchNews } from "./fetchNews.js";
import { resolveLookbackWindow, writeLastDigestAt } from "./digestState.js";
import { formatDigestMessage } from "./format.js";
import { publishDigestData } from "./publishData.js";
import { digestForLocale, summarizeNews } from "./summarize.js";
import {
  contentHash,
  publishTelemetry,
  storyRefs,
  summarizeCost,
} from "./telemetry.js";
import { sendToTelegram } from "./telegram.js";
import type { Locale } from "./locale.js";

async function main(): Promise<void> {
  const channels = config.channels();
  const window = await resolveLookbackWindow();
  const sinceLabel = window.since.toISOString();

  console.log(
    `Window: ${window.hours.toFixed(1)}h since ${sinceLabel}${window.isFirstRun ? " (first run)" : ""} | telegram: ${config.topN} | miniApp: ${config.miniAppTopN} | dryRun: ${config.dryRun} | channels: ${channels.map((c) => `${c.locale}→${c.chatId}`).join(", ")}`,
  );

  const items = await fetchNews(window.since);
  console.log(`Fetched ${items.length} unique items since last digest`);

  if (items.length < 1) {
    throw new Error("No news items in the lookback window");
  }

  const { digest: bilingual, telemetry } = await summarizeNews(items, window.hours);
  console.log(`Selected ${bilingual.stories.length} stories (bilingual)`);

  const publishedAt = new Date();
  const dataPath = await publishDigestData(bilingual, publishedAt, window.hours);
  console.log(`Published mini app data: ${dataPath}`);

  const preparedPosts = channels.map((channel) => {
    const digest = digestForLocale(bilingual, channel.locale, config.topN);
    return {
      channel,
      digest,
      message: formatDigestMessage(digest, publishedAt),
    };
  });

  for (const { channel, message } of preparedPosts) {

    if (config.dryRun) {
      console.log(`\n--- DRY RUN [${channel.locale}] ${channel.chatId} ---\n`);
      console.log(message);
      if (config.miniAppOpenLinkForLocale(channel.locale)) {
        console.log(`Mini App: ${config.miniAppOpenLinkForLocale(channel.locale)}`);
      }
      console.log("\n--- END ---");
      continue;
    }

    await sendToTelegram(message, channel.chatId, channel.locale);
    console.log(`Posted to ${channel.locale} channel ${channel.chatId}`);
  }

  if (!config.dryRun) {
    await writeLastDigestAt(publishedAt);
    console.log(`Updated digest state: ${publishedAt.toISOString()}`);
  }

  const telegramContentHashes = Object.fromEntries(
    preparedPosts.map(({ channel, message }) => [channel.locale, contentHash(message)]),
  ) as Partial<Record<Locale, string>>;
  const cost = summarizeCost(telemetry.calls);
  const telemetryPath = await publishTelemetry(
    {
      ...telemetry,
      generatedAt: publishedAt.toISOString(),
      cost,
      snapshot: {
        miniApp: {
          storyCount: bilingual.stories.length,
          stories: storyRefs(bilingual.stories),
        },
        telegram: {
          storyCount: Math.min(config.topN, bilingual.stories.length),
          stories: storyRefs(bilingual.stories.slice(0, config.topN)),
          contentHashes: telegramContentHashes,
        },
      },
    },
    publishedAt,
  );
  console.log(`Published AI telemetry: ${telemetryPath}`);
  if (cost.estimatedTotalUsd != null) {
    console.log(
      `[telemetry] AI cost ≈ $${cost.estimatedTotalUsd.toFixed(6)} (${cost.inputTokens} input + ${cost.outputTokens} output tokens)`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
