import { z } from "zod";

import { env } from "@/lib/env";
import type { AiMessage } from "@/server/ai";
import { isAiConfigured } from "@/server/ai";
import { runAgent } from "@/server/agent";
import { log } from "@/server/log";
import { asErrorResponse, readLimitedJson, requireSession } from "@/server/route-helpers";
import { enforceRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8_000),
      }),
    )
    .min(1)
    .max(50),
});

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Group text into ~4-word chunks (preserving whitespace) so the UI renders the
// assistant reply with a live, streamed feel.
function* chunkText(text: string): Generator<string> {
  const parts = text.split(/(\s+)/);
  let buffer = "";
  let words = 0;
  for (const part of parts) {
    buffer += part;
    if (/\S/.test(part)) {
      words += 1;
    }
    if (words >= 4) {
      yield buffer;
      buffer = "";
      words = 0;
    }
  }
  if (buffer) {
    yield buffer;
  }
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    return asErrorResponse(error);
  }

  // The agent loop fans out to the LLM provider — the costliest path. Cap it.
  const limited = await enforceRateLimit({
    identity: session.tenantId,
    route: "agent",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  let body;
  try {
    body = BodySchema.parse(await readLimitedJson(request, 200_000));
  } catch (error) {
    return asErrorResponse(error);
  }

  const messages: AiMessage[] = body.messages.map((message) =>
    message.role === "assistant"
      ? { role: "assistant", content: message.content }
      : { role: "user", content: message.content },
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(sse(data)));

      if (!isAiConfigured()) {
        send({
          type: "token",
          text:
            "Agent Chat isn't configured yet. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL in corsair-email/.env.local (any OpenAI-compatible provider) and restart.",
        });
        send({ type: "done" });
        controller.close();
        return;
      }

      try {
        for await (const event of runAgent({
          tenantId: session.tenantId,
          profile: session,
          messages,
          now: new Date(),
          signal: request.signal,
        })) {
          if (event.type === "assistant") {
            for (const chunk of chunkText(event.content)) {
              send({ type: "token", text: chunk });
            }
          } else if (event.type === "tool") {
            send({ type: "tool", label: event.label });
          } else if (event.type === "proposal") {
            send({ type: "proposal", proposal: event.proposal });
          }
        }
        send({ type: "done" });
      } catch (error) {
        log.error("agent_stream_failed", { tenantId: session.tenantId, error });
        send({
          type: "error",
          message: env.IS_PRODUCTION
            ? "The agent hit an error. Please try again."
            : error instanceof Error
              ? error.message
              : "Agent error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
