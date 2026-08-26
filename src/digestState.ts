import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

export type DigestState = {
  lastDigestAt: string;
};

const STATE_PATH = path.join(process.cwd(), "miniapp", "data", "state.json");

export async function readLastDigestAt(): Promise<Date | null> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as DigestState;
    const date = new Date(parsed.lastDigestAt);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export async function writeLastDigestAt(date: Date): Promise<void> {
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  const payload: DigestState = { lastDigestAt: date.toISOString() };
  await writeFile(STATE_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export type LookbackWindow = {
  since: Date;
  hours: number;
  isFirstRun: boolean;
};

/** News since the previous successful digest (capped for missed runs). */
export async function resolveLookbackWindow(now = new Date()): Promise<LookbackWindow> {
  const last = await readLastDigestAt();

  if (!last) {
    const hours = config.defaultLookbackHours;
    return {
      since: new Date(now.getTime() - hours * 60 * 60 * 1000),
      hours,
      isFirstRun: true,
    };
  }

  const elapsedMs = now.getTime() - last.getTime();
  const minMs = config.minLookbackHours * 60 * 60 * 1000;
  const maxMs = config.maxLookbackHours * 60 * 60 * 1000;
  const clampedMs = Math.min(Math.max(elapsedMs, minMs), maxMs);

  return {
    since: new Date(now.getTime() - clampedMs),
    hours: clampedMs / (60 * 60 * 1000),
    isFirstRun: false,
  };
}

export function utcArchiveKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}`;
}
