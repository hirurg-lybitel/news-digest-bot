import { config } from "./config.js";

const TELEGRAM_API = "https://api.telegram.org";

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

export async function sendToTelegram(text: string): Promise<void> {
  const token = config.telegramBotToken();
  const chatId = config.telegramChannelId();
  const chunks = splitMessage(text);

  for (const [i, chunk] of chunks.entries()) {
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const body = (await response.json()) as { ok: boolean; description?: string };
    if (!response.ok || !body.ok) {
      throw new Error(
        `Telegram send failed (part ${i + 1}/${chunks.length}): ${body.description ?? response.statusText}`,
      );
    }
  }
}
