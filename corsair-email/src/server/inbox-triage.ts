import type {
  InboxTriageInput,
  InboxTriageItem,
  InboxTriageResult,
  InboxTriageTimeframe,
  ThreadSummary,
} from "@/lib/types";

const DEFAULT_LIMIT = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function sortByPriorityAndRecency(left: ThreadSummary, right: ThreadSummary) {
  if (right.priorityScore !== left.priorityScore) {
    return right.priorityScore - left.priorityScore;
  }

  return toTimestamp(right.receivedAt) - toTimestamp(left.receivedAt);
}

function matchesTimeframe(thread: ThreadSummary, timeframe: InboxTriageTimeframe, nowTimestamp: number) {
  if (timeframe === "all") {
    return true;
  }

  const receivedAt = toTimestamp(thread.receivedAt);
  if (!Number.isFinite(receivedAt)) {
    return false;
  }

  const ageMs = nowTimestamp - receivedAt;
  if (ageMs < 0) {
    return true;
  }

  return ageMs <= (timeframe === "today" ? DAY_MS : 7 * DAY_MS);
}

function scoreReplyCandidate(thread: ThreadSummary) {
  let score = thread.priorityScore;
  const haystack = `${thread.subject} ${thread.snippet} ${thread.bodyExcerpt}`.toLowerCase();

  if (thread.messageCount > 1) {
    score += 8;
  }

  if (thread.subject.toLowerCase().startsWith("re:")) {
    score += 4;
  }

  if (/[?]/.test(thread.snippet) || /reply|respond|confirm|review|waiting|follow-up/.test(haystack)) {
    score += 10;
  }

  if (thread.priorityBand === "high") {
    score += 6;
  }

  return score;
}

function toTriageItem(thread: ThreadSummary, summaryReason: string): InboxTriageItem {
  return {
    threadId: thread.threadId,
    subject: thread.subject,
    sender: thread.sender,
    senderEmail: thread.senderEmail,
    snippet: thread.snippet,
    receivedAt: thread.receivedAt,
    unread: thread.unread,
    archived: thread.archived,
    messageCount: thread.messageCount,
    priorityBand: thread.priorityBand,
    priorityScore: thread.priorityScore,
    priorityReason: thread.priorityReason,
    summaryReason,
  };
}

function summarizeUnreadReason(thread: ThreadSummary) {
  return thread.priorityReason || (thread.unread ? "Unread thread." : "Recent thread.");
}

function summarizeReplyReason(thread: ThreadSummary) {
  if (thread.messageCount > 1) {
    return "Multi-message thread that likely needs a reply.";
  }
  if (thread.priorityReason) {
    return `Likely waiting on you because it is ${thread.priorityReason}.`;
  }
  return "Unread thread that likely needs a response.";
}

function summarizePriorityReason(thread: ThreadSummary) {
  return thread.priorityReason || "High-signal thread to handle next.";
}

function summarizeChangeReason(thread: ThreadSummary) {
  if (thread.unread) {
    return "New since your last check and still unread.";
  }
  return "New since your last check.";
}

export function triageThreads(
  threads: ThreadSummary[],
  input: InboxTriageInput,
): InboxTriageResult {
  const timeframe = input.timeframe ?? "all";
  const limit = Math.max(1, Math.min(input.limit ?? DEFAULT_LIMIT, 12));
  const nowTimestamp = toTimestamp(input.now ?? new Date().toISOString());
  const checkpointTimestamp = toTimestamp(input.checkpointAt ?? null);
  const query = input.query?.trim() || undefined;
  const filteredByIds =
    input.threadIds && input.threadIds.length > 0
      ? threads.filter((thread) => input.threadIds?.includes(thread.threadId))
      : threads;

  let selected: ThreadSummary[] = [];
  let usedFallback = false;

  switch (input.mode) {
    case "summarize_unread":
      selected = filteredByIds
        .filter((thread) => thread.unread && !thread.archived && matchesTimeframe(thread, timeframe, nowTimestamp))
        .sort(sortByPriorityAndRecency);
      return {
        mode: input.mode,
        timeframe,
        total: selected.length,
        query,
        usedFallback: false,
        threads: selected.slice(0, limit).map((thread) => toTriageItem(thread, summarizeUnreadReason(thread))),
      };
    case "reply_candidates":
      selected = filteredByIds
        .filter((thread) => thread.unread && !thread.archived)
        .sort((left, right) => {
          const scoreDelta = scoreReplyCandidate(right) - scoreReplyCandidate(left);
          return scoreDelta !== 0 ? scoreDelta : sortByPriorityAndRecency(left, right);
        });
      return {
        mode: input.mode,
        timeframe,
        total: selected.length,
        query,
        usedFallback: false,
        threads: selected.slice(0, limit).map((thread) => toTriageItem(thread, summarizeReplyReason(thread))),
      };
    case "priority_list":
      selected = filteredByIds.filter((thread) => !thread.archived).sort(sortByPriorityAndRecency);
      return {
        mode: input.mode,
        timeframe,
        total: selected.length,
        query,
        usedFallback: false,
        threads: selected.slice(0, limit).map((thread) => toTriageItem(thread, summarizePriorityReason(thread))),
      };
    case "changes_since_checkpoint":
      if (Number.isFinite(checkpointTimestamp)) {
        selected = filteredByIds
          .filter((thread) => toTimestamp(thread.receivedAt) > checkpointTimestamp)
          .sort((left, right) => {
            if (Number(right.unread) !== Number(left.unread)) {
              return Number(right.unread) - Number(left.unread);
            }
            return sortByPriorityAndRecency(left, right);
          });
      } else {
        usedFallback = true;
        selected = filteredByIds
          .filter((thread) => !thread.archived && matchesTimeframe(thread, "week", nowTimestamp))
          .sort(sortByPriorityAndRecency);
      }
      return {
        mode: input.mode,
        timeframe,
        total: selected.length,
        query,
        checkpointAt: input.checkpointAt ?? null,
        usedFallback,
        threads: selected.slice(0, limit).map((thread) => toTriageItem(thread, summarizeChangeReason(thread))),
      };
    case "summarize_threads":
      selected = filteredByIds.sort(sortByPriorityAndRecency);
      return {
        mode: input.mode,
        timeframe,
        total: selected.length,
        query,
        usedFallback: false,
        threads: selected.slice(0, limit).map((thread) => toTriageItem(thread, summarizeUnreadReason(thread))),
      };
  }
}
