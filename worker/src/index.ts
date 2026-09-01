export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  TELEGRAM_BOT_USERNAME: string;
  MINI_APP_SHORT_NAME: string;
}

type Locale = "ru" | "en";

type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  from?: { language_code?: string };
  text?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

const LABELS: Record<Locale, { openInApp: string }> = {
  ru: { openInApp: "Открыть в приложении" },
  en: { openInApp: "Open in app" },
};

function resolveLocale(languageCode?: string): Locale {
  return languageCode?.toLowerCase().startsWith("ru") ? "ru" : "en";
}

function miniAppOpenLink(env: Env, locale: Locale): string {
  const bot = env.TELEGRAM_BOT_USERNAME || "dayessence_bot";
  const app = env.MINI_APP_SHORT_NAME || "digest";
  return `https://t.me/${bot}/${app}?startapp=${locale}`;
}

function startMessage(locale: Locale): string {
  if (locale === "ru") {
    return (
      "<b>Суть дня</b> — дайджест главных мировых новостей два раза в сутки " +
      "(09:00 и 21:00 по Минску).\n\n" +
      "Короткие саммари — в каналах @dayessence_ru и @dayessence_en. " +
      "Полный список с фильтрами — в приложении:"
    );
  }

  return (
    "<b>Day Essence</b> — twice-daily briefing of top world news " +
    "(06:00 & 18:00 UTC).\n\n" +
    "Short summaries in @dayessence_en and @dayessence_ru. " +
    "Browse the full list with filters in the app:"
  );
}

function helpMessage(locale: Locale): string {
  if (locale === "ru") {
    return (
      "Как читать дайджест:\n\n" +
      "• Подпишитесь на @dayessence_ru или @dayessence_en\n" +
      "• Два выпуска в сутки — топ событий с кратким саммари\n" +
      "• «Читать полностью» в канале — развёрнутый текст\n" +
      "• В приложении — до 30 новостей, фильтры по разделам и источникам"
    );
  }

  return (
    "How to read the digest:\n\n" +
    "• Follow @dayessence_en or @dayessence_ru\n" +
    "• Two editions daily — top stories with short summaries\n" +
    "• «Read full story» in the channel opens the long text\n" +
    "• In the app — up to 30 stories, filters by section and source"
  );
}

async function sendReply(
  env: Env,
  chatId: number,
  text: string,
  locale: Locale,
): Promise<void> {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: LABELS[locale].openInApp,
                url: miniAppOpenLink(env, locale),
              },
            ],
          ],
        },
      }),
    },
  );

  const body = (await response.json()) as { ok: boolean; description?: string };
  if (!response.ok || !body.ok) {
    console.error("sendMessage failed:", body.description ?? response.statusText);
  }
}

function parseCommand(text: string, botUsername: string): string | undefined {
  const token = text.trim().split(/\s+/)[0];
  if (!token?.startsWith("/")) return undefined;

  const [command, mention] = token.split("@");
  if (mention && mention.toLowerCase() !== botUsername.toLowerCase()) {
    return undefined;
  }

  return command.toLowerCase();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/") {
      return new Response("Day Essence bot webhook", { status: 200 });
    }

    if (request.method !== "POST" || pathname !== "/telegram") {
      return new Response("Not found", { status: 404 });
    }

    const secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = (await request.json()) as TelegramUpdate;
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const message = update.message;
    if (!message?.text || message.chat.type !== "private") {
      return new Response("OK");
    }

    const command = parseCommand(message.text, env.TELEGRAM_BOT_USERNAME);
    if (!command) {
      return new Response("OK");
    }

    const locale = resolveLocale(message.from?.language_code);

    if (command === "/start") {
      await sendReply(env, message.chat.id, startMessage(locale), locale);
    } else if (command === "/help") {
      await sendReply(env, message.chat.id, helpMessage(locale), locale);
    }

    return new Response("OK");
  },
};
