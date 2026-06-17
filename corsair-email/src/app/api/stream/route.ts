import { requireSession } from "@/server/route-helpers";
import { subscribeRefresh } from "@/server/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Cap the stream so the platform reclaims the function; the client reconnects
// and the polling fallback covers any gap.
export const maxDuration = 60;

/**
 * Per-tenant Server-Sent Events stream. Emits a `refresh` event whenever a
 * Corsair webhook updates this tenant's inbox/calendar, so the workspace can
 * reload live without polling. A comment heartbeat keeps the connection open.
 */
export async function GET(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // controller already closed
        }
      };

      send("event: ready\ndata: {}\n\n");

      unsubscribe = subscribeRefresh(session.tenantId, () => {
        send("event: refresh\ndata: {}\n\n");
      });

      heartbeat = setInterval(() => send(": ping\n\n"), 25000);

      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
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
