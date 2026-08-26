import "dotenv/config";
import { LOCALES, type Locale } from "./locale.js";
import type { ChannelTarget } from "./types.js";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function channelForLocale(locale: Locale): string {
  const key = `TELEGRAM_CHANNEL_ID_${locale.toUpperCase()}`;
  return required(key);
}

export const config = {
  openaiApiKey: () => required("OPENAI_API_KEY"),
  openaiSecurityKey: () => required("OPENAI_SECURITY_KEY"),
  openaiProjectKey: () => optional("OPENAI_PROJECT_KEY"),
  openaiProxyUrl: () => optional("OPENAI_PROXY_URL") ?? "https://chatgpt-proxy.gdmn.app/openai",
  useOpenAiProxy: () =>
    process.env.OPENAI_USE_PROXY === "1" || Boolean(process.env.OPENAI_SECURITY_KEY?.trim()),
  telegramBotToken: () => required("TELEGRAM_BOT_TOKEN"),
  channels(): ChannelTarget[] {
    const targets: ChannelTarget[] = [];

    for (const locale of LOCALES) {
      const chatId = channelForLocale(locale);
      if (!chatId) {
        throw new Error(`Missing required env: TELEGRAM_CHANNEL_ID_${locale.toUpperCase()}`);
      }
      targets.push({ id: locale, locale, chatId });
    }

    return targets;
  },
  openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  topN: Number(process.env.DIGEST_TOP_N || 10),
  lookbackHours: Number(process.env.LOOKBACK_HOURS || 24),
  dryRun: process.argv.includes("--dry-run"),
  miniAppUrl: () => optional("MINI_APP_URL"),
  miniAppUrlForLocale(locale: Locale): string | undefined {
    const base = optional("MINI_APP_URL")?.replace(/\/$/, "");
    if (!base) return undefined;
    return `${base}/?lang=${locale}`;
  },
};
