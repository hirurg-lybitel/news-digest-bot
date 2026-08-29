import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { utcArchiveKey } from "./digestState.js";

export type TelemetryStoryRef = {
  link: string;
  source: string;
  title_en: string;
};

export type TelemetryCatalogItem = {
  title: string;
  source: string;
  link: string;
};

export type TelemetryAttempt = {
  phase: "select" | "fill";
  attempt: number;
  ok: boolean;
  storyCount?: number;
  error?: string;
  /** Truncated model JSON on failure (for Zod / shape debugging). */
  rawPreview?: string;
  stories?: TelemetryStoryRef[];
};

export type DigestTelemetry = {
  generatedAt: string;
  model: string;
  periodHours: number;
  poolSize: number;
  maxStories: number;
  minAcceptable: number;
  telegramTopN: number;
  /** Short English rationale from the model (ranking, merges, why short). */
  selectionNotes: string | null;
  attempts: TelemetryAttempt[];
  finalStoryCount: number;
  finalStories: TelemetryStoryRef[];
  /** Catalog items not used in the final list (for dedup / miss analysis). */
  unusedCatalog: TelemetryCatalogItem[];
};

function truncate(text: string, max = 2500): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function storyRefs(
  stories: Array<{ link: string; source: string; title_en: string }>,
): TelemetryStoryRef[] {
  return stories.map((s) => ({
    link: s.link,
    source: s.source,
    title_en: s.title_en,
  }));
}

export function rawPreview(raw: string): string {
  return truncate(raw.replace(/\s+/g, " ").trim());
}

export async function publishTelemetry(
  telemetry: DigestTelemetry,
  publishedAt = new Date(),
): Promise<string> {
  const dataDir = path.join(process.cwd(), "miniapp", "data");
  const telemetryDir = path.join(dataDir, "telemetry");
  await mkdir(telemetryDir, { recursive: true });

  const json = JSON.stringify(telemetry, null, 2);
  const latestPath = path.join(telemetryDir, "latest.json");
  await writeFile(latestPath, json, "utf8");
  await writeFile(path.join(telemetryDir, `${utcArchiveKey(publishedAt)}.json`), json, "utf8");

  return latestPath;
}
