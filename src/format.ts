import type { DigestResult } from "./types.js";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Формат даты для шапки: 26 августа 2026 */
export function formatMinskDate(date = new Date()): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Minsk",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDigestMessage(digest: DigestResult): string {
  const dateLabel = formatMinskDate();
  const lines: string[] = [
    `<b>Суть дня · ${escapeHtml(dateLabel)}</b>`,
    "",
    escapeHtml(digest.intro),
    "",
  ];

  digest.stories.forEach((story, index) => {
    lines.push(
      `<b>${index + 1}. ${escapeHtml(story.title)}</b>`,
      `<i>${escapeHtml(story.category)}</i> · ${escapeHtml(story.source)}`,
      escapeHtml(story.summary),
      `<a href="${escapeHtml(story.link)}">Читать полностью</a>`,
      "",
    );
  });

  return lines.join("\n").trim();
}
