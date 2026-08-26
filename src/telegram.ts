import { config } from "./config.js";
import { LOCALE_LABELS, type Locale } from "./locale.js";

const TELEGRAM_API = "https://api.telegram.org";

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; web_app: { url: string } }>>;
};

/** Telegram limit ~4096 chars; split on blank lines if needed. */
export function splitMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];

  const parts: string[] = [];
  let rest = text;

  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen * 0.5) {
      cut = rest.lastIndexOf("\n", maxLen);
    }
    if (cut < maxLen * 0.5) {
      cut = maxLen;
    }
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) parts.push(rest);
  return parts;
}

function miniAppKeyboard(locale: Locale): InlineKeyboard | undefined {
  const url = config.miniAppUrlForLocale(locale);
  if (!url) return undefined;

  return {
    inline_keyboard: [
      [
        {
          text: LOCALE_LABELS[locale].openInApp,
          web_app: { url },
        },
      ],
    ],
  };
}

export async function sendToTelegram(
  text: string,
  chatId: string,
  locale: Locale,
): Promise<void> {
  const token = config.telegramBotToken();
  const chunks = splitMessage(text);
  const keyboard = miniAppKeyboard(locale);

  for (const [i, chunk] of chunks.entries()) {
    const isLast = i === chunks.length - 1;
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        ...(isLast && keyboard ? { reply_markup: keyboard } : {}),
      }),
    });

    const body = (await response.json()) as { ok: boolean; description?: string };
    if (!response.ok || !body.ok) {
      throw new Error(
        `Telegram send failed (${chatId}, part ${i + 1}/${chunks.length}): ${body.description ?? response.statusText}`,
      );
    }
  }
}
