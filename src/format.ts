import { LOCALE_LABELS } from "./locale.js";
import type { DigestResult } from "./types.js";

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
    lines.push(
      `<b>${index + 1}. ${escapeHtml(story.title)}</b>`,
      "",
      escapeHtml(story.summary),
      `<a href="${escapeHtml(story.link)}">${escapeHtml(labels.readMore)}</a>`,
      "",
    );
  });

  return lines.join("\n").trim();
}
