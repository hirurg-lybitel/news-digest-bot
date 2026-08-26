import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

export const config = {
  openaiApiKey: () => required("OPENAI_API_KEY"),
  telegramBotToken: () => required("TELEGRAM_BOT_TOKEN"),
  telegramChannelId: () => required("TELEGRAM_CHANNEL_ID"),
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  topN: Number(process.env.DIGEST_TOP_N || 10),
  lookbackHours: Number(process.env.LOOKBACK_HOURS || 24),
  dryRun: process.argv.includes("--dry-run"),
};
