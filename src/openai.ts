import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions.js";
import { config } from "./config.js";

const DEFAULT_PROXY_URL = "https://chatgpt-proxy.gdmn.app/openai";

type ProxyChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

/** Same proxy flow as MCP-Nexus: gdmn.app forwards to OpenAI outside BY. */
async function chatViaProxy(
  params: ChatCompletionCreateParamsNonStreaming,
): Promise<string> {
  const securityKey = config.openaiSecurityKey();
  const project = config.openaiProjectKey();

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

  return content;
}

async function chatDirect(params: ChatCompletionCreateParamsNonStreaming): Promise<string> {
  const client = new OpenAI({ apiKey: config.openaiApiKey() });
  const completion = await client.chat.completions.create(params);
  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Empty OpenAI response");
  }
  return content;
}

export async function chatCompletionJson(
  params: ChatCompletionCreateParamsNonStreaming,
): Promise<string> {
  if (config.useOpenAiProxy()) {
    return chatViaProxy(params);
  }
  return chatDirect(params);
}
