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
  /** Used only to estimate cost in telemetry; override when model pricing changes. */
  openaiInputUsdPerMillion: Number(process.env.OPENAI_INPUT_USD_PER_MILLION || 0.15),
  openaiOutputUsdPerMillion: Number(process.env.OPENAI_OUTPUT_USD_PER_MILLION || 0.6),
  /** Stories in Telegram channel posts */
  topN: Number(process.env.DIGEST_TOP_N || 10),
  /** Stories selected by AI and exported to the Mini App */
  miniAppTopN: Number(process.env.MINI_APP_TOP_N || 30),
  /** First run when no state.json exists */
  defaultLookbackHours: Number(process.env.DEFAULT_LOOKBACK_HOURS || 12),
  /** Safety cap if a scheduled run was missed */
  maxLookbackHours: Number(process.env.MAX_LOOKBACK_HOURS || 24),
  /** Minimum window for manual re-runs right after a digest */
  minLookbackHours: Number(process.env.MIN_LOOKBACK_HOURS || 1),
  dryRun: process.argv.includes("--dry-run"),
  /** Temporary A/B: Telegraph (1–5) vs Mini App (6–10) for «Читать полностью» */
  readMoreAb: () => process.env.READMORE_AB === "1",
  telegraphAccessToken: () => optional("TELEGRAPH_ACCESS_TOKEN"),
  miniAppUrl: () => optional("MINI_APP_URL"),
  /** @username without @ — for t.me deep links that open inside Telegram */
  telegramBotUsername: () => optional("TELEGRAM_BOT_USERNAME") ?? "dayessence_bot",
  /** Short name from BotFather /newapp */
  miniAppShortName: () => optional("MINI_APP_SHORT_NAME") ?? "digest",
  /** HTTPS URL of the hosted web app (BotFather /newapp + Menu Button) */
  miniAppWebUrlForLocale(locale: Locale): string | undefined {
    const base = optional("MINI_APP_URL")?.replace(/\/$/, "");
    if (!base) return undefined;
    return `${base}/?lang=${locale}`;
  },
  /** t.me link — opens Mini App inside Telegram (use for channel inline buttons) */
  miniAppOpenLinkForLocale(locale: Locale): string | undefined {
    if (!optional("MINI_APP_URL")) return undefined;
    const bot = optional("TELEGRAM_BOT_USERNAME") ?? "dayessence_bot";
    const app = optional("MINI_APP_SHORT_NAME") ?? "digest";
    return `https://t.me/${bot}/${app}?startapp=${locale}`;
  },
  /** Deep link into a specific story detail screen (`startapp=ru_i5`). */
  miniAppStoryOpenLink(locale: Locale, storyIndex: number): string | undefined {
    if (!optional("MINI_APP_URL")) return undefined;
    if (!Number.isInteger(storyIndex) || storyIndex < 0) return undefined;
    const bot = optional("TELEGRAM_BOT_USERNAME") ?? "dayessence_bot";
    const app = optional("MINI_APP_SHORT_NAME") ?? "digest";
    return `https://t.me/${bot}/${app}?startapp=${locale}_i${storyIndex}`;
  },
};
