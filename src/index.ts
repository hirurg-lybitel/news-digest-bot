import { config } from "./config.js";
import { fetchNews } from "./fetchNews.js";
import { formatDigestMessage } from "./format.js";
import { summarizeNews } from "./summarize.js";
import { sendToTelegram } from "./telegram.js";

async function main(): Promise<void> {
  console.log(`Lookback: ${config.lookbackHours}h | topN: ${config.topN} | dryRun: ${config.dryRun}`);

  const items = await fetchNews(config.lookbackHours);
  console.log(`Fetched ${items.length} unique items in lookback window`);

  if (items.length < 5) {
    throw new Error(`Too few news items (${items.length}); aborting digest`);
  }

  const digest = await summarizeNews(items);
  console.log(`Selected ${digest.stories.length} stories`);

  const message = formatDigestMessage(digest);

  if (config.dryRun) {
    console.log("\n--- DRY RUN MESSAGE ---\n");
    console.log(message);
    console.log("\n--- END ---");
    return;
  }

  await sendToTelegram(message);
  console.log("Posted to Telegram channel");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
