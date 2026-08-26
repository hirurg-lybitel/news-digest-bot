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

export function formatDigestMessage(digest: DigestResult): string {
  const labels = LOCALE_LABELS[digest.locale];
  const dateLabel = formatMinskDate(digest.locale);
  const lines: string[] = [
    `<b>${escapeHtml(labels.brand)} · ${escapeHtml(dateLabel)}</b>`,
    "",
    escapeHtml(digest.intro),
    "",
  ];

  digest.stories.forEach((story, index) => {
    lines.push(
      `<b>${index + 1}. ${escapeHtml(story.title)}</b>`,
      `<i>${escapeHtml(story.category)}</i> · ${escapeHtml(story.source)}`,
      escapeHtml(story.summary),
      `<a href="${escapeHtml(story.link)}">${escapeHtml(labels.readMore)}</a>`,
      "",
    );
  });

  return lines.join("\n").trim();
}
