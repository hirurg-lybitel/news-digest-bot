import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions.js";
import { config } from "./config.js";

const DEFAULT_PROXY_URL = "https://chatgpt-proxy.gdmn.app/openai";

type ProxyChatResponse = {
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
};

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type ChatJsonResult = {
  content: string;
  model: string;
  finishReason: string | null;
  usage: AiUsage | null;
  latencyMs: number;
  estimatedCostUsd: number | null;
};

function normalizeUsage(
  usage:
    | {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      }
    | null
    | undefined,
): AiUsage | null {
  if (!usage) return null;
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
  };
}

function estimatedCostUsd(usage: AiUsage | null): number | null {
  if (!usage) return null;
  return (
    (usage.inputTokens * config.openaiInputUsdPerMillion +
      usage.outputTokens * config.openaiOutputUsdPerMillion) /
    1_000_000
  );
}

/** Same proxy flow as MCP-Nexus: gdmn.app forwards to OpenAI outside BY. */
async function chatViaProxy(
  params: ChatCompletionCreateParamsNonStreaming,
): Promise<ChatJsonResult> {
  const securityKey = config.openaiSecurityKey();
  const project = config.openaiProjectKey();
  const startedAt = Date.now();

  const response = await fetch(config.openaiProxyUrl() ?? DEFAULT_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...params,
      security_key: securityKey,
      openai_api_key: config.openaiApiKey(),
      ...(project ? { project } : {}),
    }),
  });

  const body = (await response.json()) as ProxyChatResponse;

  if (!response.ok) {
    const message =
      body.error?.message ?? `OpenAI proxy HTTP ${response.status}`;
    throw new Error(message);
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty OpenAI proxy response");
  }

  const usage = normalizeUsage(body.usage);
  return {
    content,
    model: body.model ?? params.model,
    finishReason: body.choices?.[0]?.finish_reason ?? null,
    usage,
    latencyMs: Date.now() - startedAt,
    estimatedCostUsd: estimatedCostUsd(usage),
  };
}

async function chatDirect(
  params: ChatCompletionCreateParamsNonStreaming,
): Promise<ChatJsonResult> {
  const client = new OpenAI({ apiKey: config.openaiApiKey() });
  const startedAt = Date.now();
  const completion = await client.chat.completions.create(params);
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty OpenAI response");
  }
  const usage = normalizeUsage(completion.usage);
  return {
    content,
    model: completion.model,
    finishReason: completion.choices[0]?.finish_reason ?? null,
    usage,
    latencyMs: Date.now() - startedAt,
    estimatedCostUsd: estimatedCostUsd(usage),
  };
}

export async function chatCompletionJson(
  params: ChatCompletionCreateParamsNonStreaming,
): Promise<ChatJsonResult> {
  if (config.useOpenAiProxy()) {
    return chatViaProxy(params);
  }
  return chatDirect(params);
}
