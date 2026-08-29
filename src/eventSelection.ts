import { z } from "zod";
import { config } from "./config.js";
import { chatCompletionJson, type ChatJsonResult } from "./openai.js";
import {
  CATEGORY_KEYS,
  type CategoryKey,
  type EventCluster,
  type NewsItem,
  type RankedEvent,
} from "./types.js";
import {
  callTelemetry,
  errorMessage,
  rawPreview,
  type AiCallTelemetry,
  type TelemetryCandidate,
} from "./telemetry.js";

const MAX_CANDIDATES = 80;

const ClusterSchema = z.object({
  representative: z.number().int(),
  members: z.array(z.number().int()).min(1),
  score: z.number().min(0).max(100),
  category: z.enum(CATEGORY_KEYS),
  rationale: z.string(),
});

const ClustersResponseSchema = z.object({
  clusters: z.array(ClusterSchema).min(1),
});

export type RawEventCluster = z.infer<typeof ClusterSchema>;

export type EventSelectionResult = {
  events: RankedEvent[];
  clusters: EventCluster[];
  candidates: TelemetryCandidate[];
  calls: AiCallTelemetry[];
};

const responseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "event_clusters",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["clusters"],
      properties: {
        clusters: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["representative", "members", "score", "category", "rationale"],
            properties: {
              representative: { type: "integer" },
              members: {
                type: "array",
                minItems: 1,
                items: { type: "integer" },
              },
              score: { type: "number", minimum: 0, maximum: 100 },
              category: { type: "string", enum: [...CATEGORY_KEYS] },
              rationale: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function buildPrompt(items: NewsItem[]): string {
  const catalog = items.map((item, index) => ({
    index: index + 1,
    title: item.title,
    source: item.source,
    summary: item.summary.slice(0, 450),
    publishedAt: item.publishedAt?.toISOString() ?? null,
  }));

  return `Partition every catalog item into real-world event clusters and rank the events.

Rules:
- Every catalog index 1..${catalog.length} must appear exactly once across all "members" arrays.
- Articles are the same event when they cover the same incident or decision, even across outlets/formats (article, video, live update, explainer, death-toll update).
- Choose one representative per cluster: prefer the clearest full article over a short video/update.
- "representative" must be one of that cluster's "members".
- Score each event 0..100 for global public importance. Use high scores for major conflicts, geopolitics, disasters, broad economic impact, science/health breakthroughs, and landmark law/policy.
- category must be one of: ${CATEGORY_KEYS.join(", ")}.
- rationale is one short, publishable editorial sentence explaining the score/representative choice; do not expose hidden reasoning.
- Do not select a fixed number here. Return the full partition; code will take the top ${config.miniAppTopN} clusters.

Catalog:
${JSON.stringify(catalog)}`;
}

/**
 * Makes the model response safe and total. Missing indices become low-scored
 * singleton clusters instead of triggering another expensive full-catalog call.
 */
export function repairClusters(
  raw: RawEventCluster[],
  candidateCount: number,
): EventCluster[] {
  const assigned = new Set<number>();
  const clusters: EventCluster[] = [];

  for (const cluster of raw) {
    const validMembers = [...new Set(cluster.members)]
      .filter((index) => index >= 1 && index <= candidateCount && !assigned.has(index));
    if (validMembers.length < 1) continue;

    const representativeIndex = validMembers.includes(cluster.representative)
      ? cluster.representative
      : validMembers[0]!;

    for (const index of validMembers) assigned.add(index);
    clusters.push({
      representativeIndex,
      memberIndices: validMembers,
      score: cluster.score,
      category: cluster.category as CategoryKey,
      rationale: cluster.rationale.trim(),
      ...(representativeIndex !== cluster.representative ? { repaired: true } : {}),
    });
  }

  for (let index = 1; index <= candidateCount; index++) {
    if (assigned.has(index)) continue;
    clusters.push({
      representativeIndex: index,
      memberIndices: [index],
      score: Math.max(1, 20 - index / candidateCount),
      category: "world",
      rationale: "Model omitted this catalog item; retained as a low-priority singleton.",
      repaired: true,
    });
  }

  return clusters;
}

export function rankClusters(
  clusters: EventCluster[],
  candidates: NewsItem[],
  limit: number,
): RankedEvent[] {
  return [...clusters]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.representativeIndex - b.representativeIndex,
    )
    .slice(0, limit)
    .map((cluster, index) => ({
      ...cluster,
      rank: index + 1,
      representative: candidates[cluster.representativeIndex - 1]!,
      members: cluster.memberIndices
        .map((memberIndex) => candidates[memberIndex - 1])
        .filter((item): item is NewsItem => Boolean(item)),
    }));
}

export async function selectEvents(items: NewsItem[]): Promise<EventSelectionResult> {
  const candidateItems = items.slice(0, MAX_CANDIDATES);
  const candidates = candidateItems.map((item, index) => ({
    index: index + 1,
    title: item.title,
    source: item.source,
    link: item.link,
  }));
  const calls: AiCallTelemetry[] = [];

  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    let content = "";
    let result: ChatJsonResult | undefined;
    try {
      result = await chatCompletionJson({
        model: config.openaiModel,
        temperature: 0.2,
        max_completion_tokens: 8_000,
        response_format: responseFormat,
        messages: [
          {
            role: "system",
            content:
              "You are a precise news event-clustering editor. Return only the requested JSON partition. Never invent catalog indices.",
          },
          { role: "user", content: buildPrompt(candidateItems) },
        ],
      });
      content = result.content;
      const parsed = ClustersResponseSchema.parse(JSON.parse(content));
      const clusters = repairClusters(parsed.clusters, candidateItems.length);
      const events = rankClusters(clusters, candidateItems, config.miniAppTopN);

      calls.push(
        callTelemetry("cluster", attempt, result, {
          returnedCount: parsed.clusters.length,
          acceptedCount: events.length,
        }),
      );
      return { events, clusters, candidates, calls };
    } catch (error) {
      lastError = error;
      calls.push(
        result
          ? {
              ...callTelemetry("cluster", attempt, result),
              ok: false,
              error: errorMessage(error),
              ...(content ? { rawPreview: rawPreview(content) } : {}),
            }
          : {
              stage: "cluster",
              attempt,
              ok: false,
              error: errorMessage(error),
              ...(content ? { rawPreview: rawPreview(content) } : {}),
            },
      );
      console.warn(`[cluster] attempt ${attempt}/2 failed:`, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to cluster news events");
}
