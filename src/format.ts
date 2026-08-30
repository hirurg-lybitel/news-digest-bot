import { config } from "./config.js";
import { LOCALE_LABELS } from "./locale.js";
import type { DigestResult, DigestStory } from "./types.js";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatMinskDate(locale: DigestResult["locale"], date = new Date()): string {
  const intlLocale = locale === "ru" ? "ru-RU" : "en-GB";
  return new Intl.DateTimeFormat(intlLocale, {
    timeZone: "Europe/Minsk",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** A/B: 1–5 → Telegraph, 6–10 → Mini App story deep link; else original source. */
export function readMoreHref(
  story: DigestStory,
  index: number,
  locale: DigestResult["locale"],
): string {
  if (!config.readMoreAb()) return story.link;

  if (index < 5) {
    return story.telegraphUrl || story.link;
  }
  if (index < 10) {
    return config.miniAppStoryOpenLink(locale, index) || story.link;
  }
  return story.link;
}

export function formatDigestMessage(digest: DigestResult, publishedAt = new Date()): string {
  const labels = LOCALE_LABELS[digest.locale];
  const dateLabel = formatMinskDate(digest.locale, publishedAt);
  const slot =
    publishedAt.getUTCHours() < 12
      ? digest.locale === "ru"
        ? "утро"
        : "Morning"
      : digest.locale === "ru"
        ? "вечер"
        : "Evening";
  const lines: string[] = [
    `<b>${escapeHtml(labels.brand)} · ${escapeHtml(slot)} · ${escapeHtml(dateLabel)}</b>`,
    "",
    escapeHtml(digest.intro),
    "",
  ];

  digest.stories.forEach((story, index) => {
    const href = readMoreHref(story, index, digest.locale);
    lines.push(
      `<b>${index + 1}. ${escapeHtml(story.title)}</b>`,
      "",
      escapeHtml(story.summary),
      `<a href="${escapeHtml(href)}">${escapeHtml(labels.readMore)}</a>`,
      "",
    );
  });

  return lines.join("\n").trim();
}
