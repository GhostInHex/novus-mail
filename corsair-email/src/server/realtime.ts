import { EventEmitter } from "node:events";

/**
 * Process-local pub/sub for live UI refresh. When a Corsair webhook updates a
 * tenant's inbox/calendar, we publish on that tenant's channel; the SSE
 * /api/stream route forwards a `refresh` event to that tenant's browser so the
 * workspace reloads without polling.
 *
 * Pinned on globalThis to survive Next.js dev hot-reloads (same pattern as
 * corsair-runtime.ts).
 */

declare global {
  // eslint-disable-next-line no-var
  var __corsairRealtime__: EventEmitter | undefined;
}

function bus(): EventEmitter {
  if (!globalThis.__corsairRealtime__) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    globalThis.__corsairRealtime__ = emitter;
  }
  return globalThis.__corsairRealtime__;
}

function channel(tenantId: string) {
  return `refresh:${tenantId}`;
}

export function publishRefresh(tenantId: string) {
  bus().emit(channel(tenantId));
}

export function subscribeRefresh(tenantId: string, listener: () => void): () => void {
  const name = channel(tenantId);
  bus().on(name, listener);
  return () => {
    bus().off(name, listener);
  };
}
