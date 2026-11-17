import type { AgendaEvent, ConnectionStatus, SessionUser, ThreadDetail } from "@/lib/types";

export const session = { tenantId: "visual-review", displayName: "Vinay Patel", email: "vinay@example.com", mode: "demo" } satisfies SessionUser;
const provider = { authorized: true, healthy: true, checkedAt: "2026-11-15T09:42:00.000Z", latencyMs: 0, lastError: null };
export const connection = { gmail: provider, calendar: provider, readyForWorkspace: true, degraded: false, setupLog: "" } satisfies ConnectionStatus;
const entries = [
  ["Ari Morgan", "ari@example.com", "Launch review, a little later?", "2026-11-15T09:42:00.000Z"],
  ["Mika Patel", "mika@example.com", "The deck is ready for your eyes", "2026-11-15T09:18:00.000Z"],
  ["Jordan Lee", "jordan@example.com", "Re: Product feedback", "2026-11-15T08:56:00.000Z"],
  ["Google Calendar", "calendar@example.com", "Your agenda for today", "2026-11-15T08:00:00.000Z"],
  ["Sam Rivera", "sam@example.com", "Friday design critique", "2026-11-14T09:00:00.000Z"],
  ["Alex Chen", "alex@example.com", "Notes from planning", "2026-11-14T08:00:00.000Z"],
];
export const threads: ThreadDetail[] = entries.map(([sender, senderEmail, subject, receivedAt], index) => {
  const body = index === 0 ? "Hi Vinay,\n\nCould we move our launch review to 3 PM? I have a few updates to the deck and would love your thoughts before we share it with the team.\n\nThanks,\nAri" : subject;
  return { threadId: `source-thread-${index}`, sender, senderEmail, subject, receivedAt, recipients: ["you"], snippet: body, bodyExcerpt: body, body, htmlBody: null, messageCount: 1, labels: ["INBOX"], unread: index === 0, starred: false, archived: false, priorityBand: "normal", priorityScore: 0, priorityReason: "", messages: [{ id: `message-${index}`, from: `${sender} <${senderEmail}>`, to: "you", subject, body, snippet: body, htmlBody: null, receivedAt, labels: ["INBOX"] }] };
});
export const events: AgendaEvent[] = [
  { id: "standup", summary: "Team standup", start: "2026-11-15T10:00:00.000Z", end: "2026-11-15T10:30:00.000Z", location: "Google Meet", description: "", attendees: [], status: "confirmed", htmlLink: null },
  { id: "focus", summary: "Focus time", start: "2026-11-15T13:00:00.000Z", end: "2026-11-15T14:00:00.000Z", location: "", description: "", attendees: [], status: "confirmed", htmlLink: null },
  { id: "launch", summary: "Launch review", start: "2026-11-15T15:00:00.000Z", end: "2026-11-15T15:30:00.000Z", location: "Ari Morgan · Google Meet", description: "Review the updated deck and agree on next steps.", attendees: ["ari@example.com"], status: "confirmed", htmlLink: null },
];
export const folders = [
  { id: "focus", label: "Focus queue", count: 12, hint: "" },
  { id: "all", label: "All mail", count: 48, hint: "" },
  { id: "starred", label: "Starred", count: 6, hint: "" },
  { id: "drafts", label: "Drafts", count: 3, hint: "" },
  { id: "sent", label: "Sent", count: 0, hint: "" },
] satisfies Array<{ id: "focus" | "all" | "starred" | "drafts" | "sent"; label: string; count: number; hint: string }>;

export const weekEvents: AgendaEvent[] = [
  ...events,
  { ...events[0], id: "monday-standup", start: "2026-11-16T10:00:00.000Z", end: "2026-11-16T10:30:00.000Z" },
  { ...events[2], id: "monday-launch", start: "2026-11-16T15:00:00.000Z", end: "2026-11-16T15:30:00.000Z" },
  ...[17, 18, 19, 20].map(day => ({ ...events[1], id: `focus-${day}`, start: `2026-11-${day}T10:00:00.000Z`, end: `2026-11-${day}T11:00:00.000Z` })),
];
