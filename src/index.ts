import { config } from "./config.js";
import { fetchNews } from "./fetchNews.js";
import { resolveLookbackWindow, writeLastDigestAt } from "./digestState.js";
import { formatDigestMessage } from "./format.js";
import { publishDigestData } from "./publishData.js";
import { digestForLocale, summarizeNews } from "./summarize.js";
import { sendToTelegram } from "./telegram.js";

async function main(): Promise<void> {
  const channels = config.channels();
  const window = await resolveLookbackWindow();
  const sinceLabel = window.since.toISOString();

  console.log(
    `Window: ${window.hours.toFixed(1)}h since ${sinceLabel}${window.isFirstRun ? " (first run)" : ""} | topN: ${config.topN} | dryRun: ${config.dryRun} | channels: ${channels.map((c) => `${c.locale}→${c.chatId}`).join(", ")}`,
  );

  const items = await fetchNews(window.since);
  console.log(`Fetched ${items.length} unique items since last digest`);

  if (items.length < config.topN) {
    throw new Error(`Too few news items (${items.length}); need at least ${config.topN}`);
  }

  const bilingual = await summarizeNews(items, window.hours);
  console.log(`Selected ${bilingual.stories.length} stories (bilingual)`);

  const publishedAt = new Date();
  const dataPath = await publishDigestData(bilingual, publishedAt, window.hours);
  console.log(`Published mini app data: ${dataPath}`);

  for (const channel of channels) {
    const digest = digestForLocale(bilingual, channel.locale);
    const message = formatDigestMessage(digest, publishedAt);

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
