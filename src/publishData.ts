import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { utcArchiveKey } from "./digestState.js";
import type { Locale } from "./locale.js";
import type { BilingualDigest } from "./types.js";

export type DigestPayload = {
  generatedAt: string;
  date: string;
  slot: "morning" | "evening";
  periodHours: number;
  intro: Record<Locale, string>;
  stories: BilingualDigest["stories"];
};

function minskDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function publishDigestData(
  digest: BilingualDigest,
  publishedAt = new Date(),
  periodHours = 12,
): Promise<string> {
  const dataDir = path.join(process.cwd(), "miniapp", "data");
  const archiveDir = path.join(dataDir, "archive");
  await mkdir(archiveDir, { recursive: true });

  const slot = publishedAt.getUTCHours() < 12 ? "morning" : "evening";

  const payload: DigestPayload = {
    generatedAt: publishedAt.toISOString(),
    date: minskDateKey(publishedAt),
    slot,
    periodHours,
    intro: digest.intro,
    stories: digest.stories,
  };

  const json = JSON.stringify(payload, null, 2);
  const latestPath = path.join(dataDir, "digest.json");
  await writeFile(latestPath, json, "utf8");
  await writeFile(path.join(archiveDir, `${utcArchiveKey(publishedAt)}.json`), json, "utf8");

  return latestPath;
}
