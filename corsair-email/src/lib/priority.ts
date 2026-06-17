import type { ThreadSummary } from "@/lib/types";

const VIP_KEYWORDS = [
  "urgent",
  "asap",
  "board",
  "investor",
  "contract",
  "budget",
  "approve",
  "approval",
  "launch",
];

const LOW_SIGNAL_KEYWORDS = [
  "newsletter",
  "digest",
  "receipt",
  "invoice available",
  "promotion",
  "sale",
  "unsubscribe",
];

const IMPORTANT_LABELS = new Set(["IMPORTANT", "STARRED"]);

export function classifyPriority(summary: Omit<ThreadSummary, "priorityBand" | "priorityScore" | "priorityReason">) {
  let score = 30;
  const reasons: string[] = [];
  const haystack = `${summary.subject} ${summary.snippet} ${summary.bodyExcerpt}`.toLowerCase();

  if (summary.unread) {
    score += 18;
    reasons.push("unread");
  }

  if (summary.starred) {
    score += 16;
    reasons.push("starred");
  }

  if (summary.labels.some((label) => IMPORTANT_LABELS.has(label))) {
    score += 20;
    reasons.push("important label");
  }

  if (VIP_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    score += 22;
    reasons.push("urgent language");
  }

  if (summary.senderEmail.endsWith(".gov") || summary.senderEmail.endsWith(".edu")) {
    score += 8;
    reasons.push("institutional sender");
  }

  if (summary.archived) {
    score -= 10;
  }

  if (LOW_SIGNAL_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    score -= 30;
    reasons.push("newsletter-like");
  }

  const priorityBand: ThreadSummary["priorityBand"] =
    score >= 65 ? "high" : score <= 18 ? "low" : "normal";

  return {
    priorityBand,
    priorityScore: score,
    priorityReason: reasons[0] ?? "conversation context",
  };
}
