import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { utcArchiveKey } from "./digestState.js";
import { config } from "./config.js";
import type { AiUsage, ChatJsonResult } from "./openai.js";
import type { EventCluster } from "./types.js";
import type { Locale } from "./locale.js";

export type TelemetryStoryRef = {
  link: string;
  source: string;
  title_en: string;
};

export type TelemetryCandidate = {
  index: number;
  title: string;
  source: string;
  link: string;
};

export type AiCallTelemetry = {
  stage: "cluster" | "localize";
  attempt: number;
  ok: boolean;
  model?: string;
  finishReason?: string | null;
  latencyMs?: number;
  usage?: AiUsage | null;
  estimatedCostUsd?: number | null;
  returnedCount?: number;
  acceptedCount?: number;
  error?: string;
  rawPreview?: string;
};

export type SummarizeTelemetry = {
  model: string;
  periodHours: number;
  poolSize: number;
  candidateCount: number;
  maxStories: number;
  telegramTopN: number;
  candidates: TelemetryCandidate[];
  clusters: EventCluster[];
  calls: AiCallTelemetry[];
};

export type CostSummary = {
  currency: "USD";
  estimatedTotalUsd: number | null;
  complete: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

export type DigestTelemetry = SummarizeTelemetry & {
  generatedAt: string;
  cost: CostSummary;
  snapshot: {
    miniApp: {
      storyCount: number;
      stories: TelemetryStoryRef[];
    };
    telegram: {
      storyCount: number;
      stories: TelemetryStoryRef[];
      contentHashes: Partial<Record<Locale, string>>;
    };
  };
};

function truncate(text: string, max = 2500): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function callTelemetry(
  stage: AiCallTelemetry["stage"],
  attempt: number,
  result: ChatJsonResult,
  counts?: { returnedCount?: number; acceptedCount?: number },
): AiCallTelemetry {
  return {
    stage,
    attempt,
    ok: true,
    model: result.model,
    finishReason: result.finishReason,
    latencyMs: result.latencyMs,
    usage: result.usage,
    estimatedCostUsd: result.estimatedCostUsd,
    ...counts,
  };
}

export function storyRefs(
  stories: Array<{
    link: string;
    source: string;
    title_en?: string;
    title?: { en: string };
  }>,
): TelemetryStoryRef[] {
  return stories.map((s) => ({
    link: s.link,
    source: s.source,
    title_en: s.title_en ?? s.title?.en ?? "",
  }));
}

export function rawPreview(raw: string): string {
  return truncate(raw.replace(/\s+/g, " ").trim());
}

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function summarizeCost(calls: AiCallTelemetry[]): CostSummary {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let estimatedTotalUsd = 0;
  let pricedCalls = 0;
  let apiResponses = 0;

  for (const call of calls) {
    if (call.model || call.usage || call.latencyMs != null) apiResponses++;
    if (call.usage) {
      inputTokens += call.usage.inputTokens;
      outputTokens += call.usage.outputTokens;
      totalTokens += call.usage.totalTokens;
    }
    if (call.estimatedCostUsd != null) {
      estimatedTotalUsd += call.estimatedCostUsd;
      pricedCalls++;
    }
  }

  return {
    currency: "USD",
    estimatedTotalUsd: pricedCalls > 0 ? estimatedTotalUsd : null,
    complete: apiResponses > 0 && pricedCalls === apiResponses,
    inputTokens,
    outputTokens,
    totalTokens,
    inputUsdPerMillion: config.openaiInputUsdPerMillion,
    outputUsdPerMillion: config.openaiOutputUsdPerMillion,
  };
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
