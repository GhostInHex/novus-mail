import assert from "node:assert/strict";
import test from "node:test";

import { triageThreads } from "@/server/inbox-triage";
import type { ThreadSummary } from "@/lib/types";

function makeThread(overrides: Partial<ThreadSummary>): ThreadSummary {
  return {
    threadId: overrides.threadId ?? crypto.randomUUID(),
    subject: overrides.subject ?? "Thread",
    sender: overrides.sender ?? "Sender",
    senderEmail: overrides.senderEmail ?? "sender@example.com",
    recipients: overrides.recipients ?? ["me@example.com"],
    snippet: overrides.snippet ?? "Please review this",
    bodyExcerpt: overrides.bodyExcerpt ?? "Please review this when you can",
    receivedAt: overrides.receivedAt ?? "2026-06-18T08:00:00.000Z",
    messageCount: overrides.messageCount ?? 1,
    labels: overrides.labels ?? ["INBOX"],
    unread: overrides.unread ?? true,
    starred: overrides.starred ?? false,
    archived: overrides.archived ?? false,
    priorityBand: overrides.priorityBand ?? "normal",
    priorityScore: overrides.priorityScore ?? 50,
    priorityReason: overrides.priorityReason ?? "conversation context",
  };
}

test("summarize_unread returns unread threads in priority order", () => {
  const result = triageThreads(
    [
      makeThread({ threadId: "a", priorityScore: 90, priorityReason: "urgent language" }),
      makeThread({ threadId: "b", priorityScore: 40 }),
      makeThread({ threadId: "c", unread: false, priorityScore: 100 }),
    ],
    {
      mode: "summarize_unread",
      timeframe: "all",
      now: "2026-06-18T12:00:00.000Z",
    },
  );

  assert.equal(result.total, 2);
  assert.deepEqual(result.threads.map((thread) => thread.threadId), ["a", "b"]);
});

test("changes_since_checkpoint returns newer mail", () => {
  const result = triageThreads(
    [
      makeThread({ threadId: "older", receivedAt: "2026-06-18T07:00:00.000Z" }),
      makeThread({ threadId: "newer", receivedAt: "2026-06-18T11:00:00.000Z", priorityScore: 70 }),
    ],
    {
      mode: "changes_since_checkpoint",
      checkpointAt: "2026-06-18T09:00:00.000Z",
      now: "2026-06-18T12:00:00.000Z",
    },
  );

  assert.equal(result.usedFallback, false);
  assert.deepEqual(result.threads.map((thread) => thread.threadId), ["newer"]);
});

test("changes_since_checkpoint falls back cleanly without a checkpoint", () => {
  const result = triageThreads(
    [
      makeThread({ threadId: "recent", receivedAt: "2026-06-17T18:00:00.000Z", priorityScore: 80 }),
      makeThread({ threadId: "older", receivedAt: "2026-05-10T18:00:00.000Z", priorityScore: 90 }),
    ],
    {
      mode: "changes_since_checkpoint",
      now: "2026-06-18T12:00:00.000Z",
    },
  );

  assert.equal(result.usedFallback, true);
  assert.deepEqual(result.threads.map((thread) => thread.threadId), ["recent"]);
});
