import { config } from "./config.js";
import { fetchNews } from "./fetchNews.js";
import { formatDigestMessage } from "./format.js";
import { publishDigestData } from "./publishData.js";
import { digestForLocale, summarizeNews } from "./summarize.js";
import { sendToTelegram } from "./telegram.js";

async function main(): Promise<void> {
  const channels = config.channels();
  console.log(
    `Lookback: ${config.lookbackHours}h | topN: ${config.topN} | dryRun: ${config.dryRun} | channels: ${channels.map((c) => `${c.locale}→${c.chatId}`).join(", ")}`,
  );

  const items = await fetchNews(config.lookbackHours);
  console.log(`Fetched ${items.length} unique items in lookback window`);

  if (items.length < 5) {
    throw new Error(`Too few news items (${items.length}); aborting digest`);
  }

  const bilingual = await summarizeNews(items);
  console.log(`Selected ${bilingual.stories.length} stories (bilingual)`);

  const dataPath = await publishDigestData(bilingual);
  console.log(`Published mini app data: ${dataPath}`);

  for (const channel of channels) {
    const digest = digestForLocale(bilingual, channel.locale);
    const message = formatDigestMessage(digest);

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
