import { env } from "@/lib/env";

/**
 * Provider-neutral AI operator.
 *
 * Talks to any OpenAI-compatible `/chat/completions` endpoint — OpenAI, xAI/Grok,
 * Gemini (compat), Groq, OpenRouter, Mistral, or a local model (Ollama/LM Studio).
 * Configured entirely via env (AI_BASE_URL / AI_API_KEY / AI_MODEL); no vendor SDK,
 * no hardcoded model. When unset, `isAiConfigured()` is false and the Agent Chat
 * is disabled while the rest of the app keeps working.
 */

export type AiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AiMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: AiToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string; name?: string };

export type AiTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type AiAssistantMessage = {
  role: "assistant";
  content: string;
  tool_calls?: AiToolCall[];
};

export function isAiConfigured(): boolean {
  return Boolean(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL);
}

export function aiOperatorInfo() {
  return {
    configured: isAiConfigured(),
    label: env.AI_OPERATOR_LABEL || "AI",
    model: env.AI_MODEL || "",
  };
}

function chatCompletionsUrl() {
  return `${env.AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`;
}

function compactPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

function providerErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const data = payload as { error?: unknown; message?: unknown };
  if (typeof data.error === "string") {
    return data.error;
  }
  if (data.error && typeof data.error === "object") {
    const error = data.error as { message?: unknown };
    if (typeof error.message === "string") {
      return error.message;
    }
  }
  return typeof data.message === "string" ? data.message : "";
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  const looksJson = /^\s*[{[]/.test(text);

  if (!contentType.includes("application/json") && !looksJson) {
    const preview = compactPreview(text);
    throw new Error(
      "AI provider returned a non-JSON response. Check AI_BASE_URL; for OpenAI use https://api.openai.com/v1." +
        (preview ? ` Response started with: ${preview}` : ""),
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      "AI provider returned malformed JSON. Check AI_BASE_URL and provider compatibility." +
        (text ? ` Response started with: ${compactPreview(text)}` : ""),
    );
  }
}

/**
 * One non-streaming chat round. Returns the assistant message including any
 * `tool_calls`. The agent loop drives tool execution; streaming to the UI is
 * handled at the route layer to stay portable across providers (some return
 * tool calls only in non-streamed responses).
 */
export async function aiChat(opts: {
  messages: AiMessage[];
  tools?: AiTool[];
  signal?: AbortSignal;
}): Promise<AiAssistantMessage> {
  if (!isAiConfigured()) {
    throw new Error("AI operator is not configured. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL.");
  }

  const response = await fetch(chatCompletionsUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_API_KEY}`,
    },
    signal: opts.signal,
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: opts.messages,
      ...(opts.tools && opts.tools.length > 0
        ? { tools: opts.tools, tool_choice: "auto" }
        : {}),
      stream: false,
    }),
  });

  const data = (await readJsonResponse(response)) as {
    error?: unknown;
    choices?: Array<{ message?: { content?: string | null; tool_calls?: AiToolCall[] } }>;
  };

  if (!response.ok) {
    const detail = providerErrorMessage(data);
    throw new Error(`AI request failed (${response.status}). ${detail || "No provider error details."}`.trim());
  }

  const message = data.choices?.[0]?.message ?? {};

  return {
    role: "assistant",
    content: message.content ?? "",
    tool_calls: message.tool_calls && message.tool_calls.length > 0 ? message.tool_calls : undefined,
  };
}
