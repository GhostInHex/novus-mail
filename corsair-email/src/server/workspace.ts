import { createHash } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import { processWebhook } from "corsair";
import { AuthMissingError, createAccountKeyManager } from "corsair/core";
import { createCorsairDatabase } from "corsair/db";
import { setupCorsair } from "corsair/setup";

import { parseCommand } from "@/lib/command-parser";
import { env } from "@/lib/env";
import { log } from "@/server/log";
import { collectGmailThreadIds } from "@/lib/gmail-pagination";
import { normalizeThread } from "@/lib/gmail-normalize";
import { buildMimeMessage } from "@/lib/mime";
import { classifyPriority } from "@/lib/priority";
import type {
  AgendaEvent,
  CommandResult,
  ComposeInput,
  ConnectionStatus,
  EventInput,
  InboxTriageInput,
  ProviderStatus,
  SessionUser,
  ThreadDetail,
  ThreadSummary,
  WorkspacePayload,
} from "@/lib/types";
import { safeJsonParse } from "@/lib/utils";
import { getAppDb, getCorsair, getDrizzleDb } from "@/server/corsair-client";
import { schema } from "@/server/db";
import { buildDemoSession, isDemoTenant } from "@/server/demo";
import { triageThreads } from "@/server/inbox-triage";
import { publishRefresh } from "@/server/realtime";

type SyncResource = "inbox" | "calendar";

type DrizzleThreadCacheRow = typeof schema.emailThreadCache.$inferSelect;
type DrizzleCalendarCacheRow = typeof schema.calendarEventCache.$inferSelect;

type RawThreadCacheRow = {
  thread_id: string;
  subject: string | null;
  sender: string | null;
  sender_email: string | null;
  recipients: string | null;
  snippet: string | null;
  body_excerpt: string | null;
  body_text: string | null;
  html_body: string | null;
  messages_json: ThreadDetail["messages"] | string | null;
  received_at: Date | string | null;
  message_count: number | null;
  labels_json: string | null;
  unread: boolean | null;
  starred: boolean | null;
  archived: boolean | null;
  priority_band: string | null;
  priority_score: number | null;
  priority_reason: string | null;
};

type RawCalendarCacheRow = {
  event_id: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  start_value: string | null;
  end_value: string | null;
  attendees_json: string | null;
  status: string | null;
  html_link: string | null;
};

type ThreadCacheRow = DrizzleThreadCacheRow | RawThreadCacheRow;
type CalendarCacheRow = DrizzleCalendarCacheRow | RawCalendarCacheRow;
type ThreadSummaryRow = Pick<
  DrizzleThreadCacheRow,
  | "threadId"
  | "subject"
  | "sender"
  | "senderEmail"
  | "recipients"
  | "snippet"
  | "bodyExcerpt"
  | "receivedAt"
  | "messageCount"
  | "labelsJson"
  | "unread"
  | "starred"
  | "archived"
  | "priorityBand"
  | "priorityScore"
  | "priorityReason"
>;

const GMAIL_SYNC_THREAD_LIMIT = 500;
const GMAIL_SEARCH_THREAD_LIMIT = 100;
const GMAIL_DETAIL_CONCURRENCY = 8;
const INITIAL_WORKSPACE_THREAD_PAGE_SIZE = 100;
const BACKGROUND_SYNC_BATCH_SIZE = 100;
const BACKGROUND_SYNC_TARGET = 500;
const CALENDAR_PAGE_SIZE = 100;
const CALENDAR_SYNC_EVENT_LIMIT = 500;
const SETUP_TIMEOUT_MS = 12_000;
const CONNECTION_CHECK_TIMEOUT_MS = 5_000;
const DASHBOARD_REMOTE_FALLBACK_TIMEOUT_MS = 15_000;
type DemoMemoryStore = Map<string, {threads:Map<string,ThreadDetail>;events:Map<string,AgendaEvent>;syncedAt:{inbox:string|null;calendar:string|null}}>;
const demoRuntime = globalThis as typeof globalThis & {novusMailDemoMemoryStore?:DemoMemoryStore};
const demoMemoryStore: DemoMemoryStore = demoRuntime.novusMailDemoMemoryStore ??= new Map();

function now() {
  return new Date();
}

function getDemoMemoryWorkspace(tenantId: string) {
  let workspace = demoMemoryStore.get(tenantId);
  if (workspace && Array.from(workspace.threads.keys()).some((id) => id.startsWith("demo-thread-") || id.startsWith("demo-curated-"))) {
    for (const id of workspace.threads.keys()) if (id.startsWith("demo-thread-") || id.startsWith("demo-curated-")) workspace.threads.delete(id);
    for (const id of workspace.events.keys()) if (id.startsWith("demo-event-")) workspace.events.delete(id);
    for (const thread of buildDemoThreads()) workspace.threads.set(thread.threadId, thread);
    for (const event of buildDemoEvents()) workspace.events.set(event.id, event);
  }
  if (!workspace) {
    const seededThreads = new Map(buildDemoThreads().map((thread) => [thread.threadId, thread]));
    const seededEvents = new Map(buildDemoEvents().map((event) => [event.id, event]));
    const syncedAt = {
      inbox: new Date().toISOString(),
      calendar: new Date().toISOString(),
    };
    workspace = {
      threads: seededThreads,
      events: seededEvents,
      syncedAt,
    };
    demoMemoryStore.set(tenantId, workspace);
  }
  if (!workspace.threads.has("demo-v2-thread-53")) {
    for (const thread of buildDemoThreads().slice(27)) {
      if (!workspace.threads.has(thread.threadId)) workspace.threads.set(thread.threadId, thread);
    }
  }
  if (!workspace.events.has("demo-v2-event-23")) {
    for (const event of buildDemoEvents().slice(20)) {
      if (!workspace.events.has(event.id)) workspace.events.set(event.id, event);
    }
  }
  return workspace;
}

function sortDemoThreads(threads: ThreadDetail[]) {
  return [...threads].sort((left, right) => (right.receivedAt ?? "").localeCompare(left.receivedAt ?? "") || left.threadId.localeCompare(right.threadId));
}

function sortDemoEvents(events: AgendaEvent[]) {
  return [...events].sort((left, right) => (left.start ?? "").localeCompare(right.start ?? ""));
}

function touchDemoSyncState(
  tenantId: string,
  resource: SyncResource,
  at = new Date().toISOString(),
) {
  const workspace = getDemoMemoryWorkspace(tenantId);
  workspace.syncedAt = {
    ...workspace.syncedAt,
    [resource]: at,
  };
}

function timeoutError(label: string, timeoutMs: number) {
  return new Error(`${label} timed out after ${timeoutMs}ms`);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(timeoutError(label, timeoutMs)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function settleProviderStatus(
  label: string,
  authorized: boolean,
  promiseFactory: () => Promise<unknown>,
  timeoutMs: number,
): Promise<ProviderStatus> {
  if (!authorized) {
    return {
      authorized: false,
      healthy: null,
      checkedAt: null,
      latencyMs: null,
      lastError: null,
    };
  }

  const startedAt = Date.now();
  try {
    await withTimeout(promiseFactory(), timeoutMs, label);
    return {
      authorized: true,
      healthy: true,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      lastError: null,
    };
  } catch (error) {
    log.warn("connection_check_failed", { label, timeoutMs, error });
    return {
      authorized: true,
      healthy: false,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      lastError: error instanceof Error ? error.message : "unknown",
    };
  }
}

function toIsoString(value: Date | string | number | null | undefined) {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  return value;
}

function toTimestamp(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function toBoolean(value: boolean | number | string | null | undefined) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true";
  }

  return false;
}

function toPriorityBand(value: string | null | undefined): ThreadSummary["priorityBand"] {
  if (value === "high" || value === "low" || value === "normal") {
    return value;
  }

  return "normal";
}

function normalizeThreadRow(row: ThreadCacheRow): DrizzleThreadCacheRow {
  if ("threadId" in row) {
    return row;
  }

  return {
    tenantId: "",
    threadId: row.thread_id,
    subject: row.subject,
    sender: row.sender,
    senderEmail: row.sender_email,
    recipients: row.recipients ?? "[]",
    snippet: row.snippet,
    bodyExcerpt: row.body_excerpt,
    bodyText: row.body_text ?? "",
    htmlBody: row.html_body,
    messagesJson: row.messages_json ?? [],
    receivedAt: row.received_at instanceof Date ? row.received_at : row.received_at ? new Date(row.received_at) : null,
    messageCount: row.message_count ?? 0,
    labelsJson: row.labels_json ?? "[]",
    unread: row.unread ?? false,
    starred: row.starred ?? false,
    archived: row.archived ?? false,
    priorityBand: row.priority_band ?? "normal",
    priorityScore: row.priority_score ?? 0,
    priorityReason: row.priority_reason ?? "",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function normalizeCalendarRow(row: CalendarCacheRow): DrizzleCalendarCacheRow {
  if ("eventId" in row) {
    return row;
  }

  return {
    tenantId: "",
    eventId: row.event_id,
    summary: row.summary ?? "",
    description: row.description ?? "",
    location: row.location ?? "",
    startAt: null,
    endAt: null,
    startValue: row.start_value,
    endValue: row.end_value,
    attendeesJson: row.attendees_json ?? "[]",
    status: row.status ?? "confirmed",
    htmlLink: row.html_link,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function parseStringArray(value: string | null | undefined) {
  return safeJsonParse<string[]>(value, []);
}

function parseMessages(value: DrizzleThreadCacheRow["messagesJson"] | RawThreadCacheRow["messages_json"]) {
  if (Array.isArray(value)) {
    return value as ThreadDetail["messages"];
  }

  if (typeof value !== "string") {
    return [];
  }

  return safeJsonParse<ThreadDetail["messages"]>(value, []);
}

function toEventStatus(value: string | null | undefined): AgendaEvent["status"] {
  if (value === "confirmed" || value === "tentative" || value === "cancelled") {
    return value;
  }

  return "confirmed";
}

async function appDb() {
  return getAppDb();
}

async function drizzleDb() {
  return getDrizzleDb();
}

async function corsair() {
  return getCorsair();
}

function isDemoSessionLike(session: SessionUser) {
  return session.mode === "demo" || isDemoTenant(session.tenantId);
}

function demoCalendarLink(eventId: string) {
  return `https://demo.novusmail.local/calendar/${eventId}`;
}

function uniqueLabels(labels: string[]) {
  return labels.filter((label, index, values) => Boolean(label) && values.indexOf(label) === index);
}

function addLabel(labels: string[], label: string) {
  return uniqueLabels([...labels, label]);
}

function removeLabel(labels: string[], label: string) {
  return labels.filter((value) => value !== label);
}

function syncDemoMessageLabels(messages: ThreadDetail["messages"], labels: string[]) {
  return messages.map((message) => ({
    ...message,
    labels,
  }));
}

function applyDemoThreadAction(
  current: ThreadDetail,
  action: "archive" | "unarchive" | "star" | "unstar" | "read" | "unread" | "trash" | "untrash",
): ThreadDetail {
  let unread = current.unread;
  let starred = current.starred;
  let archived = current.archived;
  let labels = [...current.labels];

  switch (action) {
    case "archive":
      archived = true;
      labels = removeLabel(labels, "INBOX");
      break;
    case "unarchive":
      archived = false;
      labels = removeLabel(labels, "TRASH");
      labels = addLabel(labels, "INBOX");
      break;
    case "star":
      starred = true;
      labels = addLabel(labels, "STARRED");
      break;
    case "unstar":
      starred = false;
      labels = removeLabel(labels, "STARRED");
      break;
    case "read":
      unread = false;
      labels = removeLabel(labels, "UNREAD");
      break;
    case "unread":
      unread = true;
      labels = addLabel(labels, "UNREAD");
      break;
    case "trash":
      archived = true;
      labels = removeLabel(labels, "INBOX");
      labels = addLabel(labels, "TRASH");
      break;
    case "untrash":
      archived = false;
      labels = removeLabel(labels, "TRASH");
      labels = addLabel(labels, "INBOX");
      break;
  }

  if (archived) {
    labels = removeLabel(labels, "INBOX");
  } else if (!labels.includes("TRASH") && !labels.includes("DRAFT") && !labels.includes("SENT")) {
    labels = addLabel(labels, "INBOX");
  }

  labels = uniqueLabels(labels);

  return {
    ...current,
    unread,
    starred,
    archived,
    labels,
    messages: syncDemoMessageLabels(current.messages, labels),
  };
}

let integrationCredentialSetup: Promise<boolean> | null = null;

async function maybeSetOAuthClient(
  keys: {
    get_client_id: () => Promise<string | null>;
    get_client_secret: () => Promise<string | null>;
    set_client_id: (value: string | null) => Promise<void>;
    set_client_secret: (value: string | null) => Promise<void>;
  },
  clientId: string,
  clientSecret: string,
) {
  if (!clientId || !clientSecret) {
    return false;
  }

  const [existingClientId, existingClientSecret] = await Promise.all([
    keys.get_client_id(),
    keys.get_client_secret(),
  ]);

  const updates: Array<Promise<void>> = [];
  if (existingClientId !== clientId) {
    updates.push(keys.set_client_id(clientId));
  }
  if (existingClientSecret !== clientSecret) {
    updates.push(keys.set_client_secret(clientSecret));
  }

  await Promise.all(updates);
  return true;
}

async function ensureIntegrationCredentials() {
  integrationCredentialSetup ??= (async () => {
    const client = (await corsair()) as any;
    const seeded = await Promise.all([
      maybeSetOAuthClient(client.keys.gmail, env.GMAIL_CLIENT_ID, env.GMAIL_CLIENT_SECRET),
      maybeSetOAuthClient(
        client.keys.googlecalendar,
        env.GOOGLECALENDAR_CLIENT_ID,
        env.GOOGLECALENDAR_CLIENT_SECRET,
      ),
    ]);
    let updatedTopicId = false;

    if (env.GMAIL_TOPIC_ID && client.keys.gmail.get_topic_id && client.keys.gmail.set_topic_id) {
      const existingTopicId = await client.keys.gmail.get_topic_id();
      if (!existingTopicId) {
        await client.keys.gmail.set_topic_id(env.GMAIL_TOPIC_ID);
        updatedTopicId = true;
      }
    }

    return seeded.some(Boolean) || updatedTopicId;
  })();

  try {
    return await integrationCredentialSetup;
  } catch (error) {
    integrationCredentialSetup = null;
    throw error;
  }
}

async function tenantClient(tenantId: string) {
  return (await corsair()).withTenant(tenantId);
}

function isAuthError(error: unknown) {
  return error instanceof AuthMissingError || (error instanceof Error && /auth|credential|token/i.test(error.message));
}

function asAgendaEvent(event: any): AgendaEvent {
  return {
    id: event?.id ?? crypto.randomUUID(),
    summary: event?.summary ?? "Untitled event",
    description: event?.description ?? "",
    location: event?.location ?? "",
    start: event?.start?.dateTime ?? event?.start?.date ?? null,
    end: event?.end?.dateTime ?? event?.end?.date ?? null,
    attendees: (event?.attendees ?? []).map((attendee: any) => attendee?.email).filter(Boolean),
    status: event?.status ?? "confirmed",
    htmlLink: event?.htmlLink ?? null,
  };
}

async function upsertProfile(session: SessionUser) {
  const db = await drizzleDb();
  const timestamp = now();

  await db
    .insert(schema.appProfiles)
    .values({
      tenantId: session.tenantId,
      email: session.email,
      displayName: session.displayName,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .onConflictDoUpdate({
      target: schema.appProfiles.tenantId,
      set: {
        email: session.email,
        displayName: session.displayName,
        updatedAt: timestamp,
      },
    });
}

function demoBaseNow() {
  const day = new Date();
  day.setUTCHours(9, 30, 0, 0);
  return day;
}

function makeDemoDate(offsetMinutes: number) {
  return new Date(demoBaseNow().getTime() + offsetMinutes * 60_000);
}

function makeDemoMessage(args: {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  receivedAt: string;
  labels: string[];
}) {
  return {
    id: args.id,
    from: args.from,
    to: args.to,
    subject: args.subject,
    snippet: args.snippet,
    body: args.body,
    htmlBody: `<p>${args.body.replace(/\n/g, "</p><p>")}</p>`,
    receivedAt: args.receivedAt,
    labels: args.labels,
  } satisfies ThreadDetail["messages"][number];
}

function buildDemoThreads(): ThreadDetail[] {
  const curated = [
    ["Ari Morgan", "ari@northstarhq.com", "Launch review: decisions needed before tomorrow", "Hi,\n\nThe onboarding flow is ready for review. Can you confirm the rollout audience and whether support should be on the launch call? I need to send the final brief today.\n\nThanks,\nAri", "INBOX UNREAD STARRED"],
    ["Leo Kim", "leo@seabound.ai", "Customer escalation: workspace access", "Hi,\n\nTwo members of the Seabound team lost access after their domain change. Could we agree on an owner and an update time before our customer follow-up?\n\nLeo", "INBOX UNREAD"],
    ["Priya Shah", "priya@vectorlane.com", "Product designer interviews next week", "Hi,\n\nThe panel is available Tuesday afternoon. Would you prefer to meet the candidate before the portfolio review, or join the final debrief?\n\nPriya", "INBOX UNREAD STARRED"],
    ["Mika Patel", "mika@brightharbor.io", "Board packet: metrics and open questions", "Hi,\n\nI have updated the retention and pipeline pages. Please take a look at the assumptions on page four before our board packet review.\n\nMika", "INBOX"],
    ["Nadia Flores", "nadia@marketforge.co", "Introduction: partnership with Marketforge", "Hi,\n\nThanks for the introduction last week. Our teams seem to have a shared audience; would a short conversation next week make sense?\n\nBest,\nNadia", "INBOX UNREAD"],
    ["Finance", "finance@northstarhq.com", "Expense reports due this week", "Hello,\n\nA reminder that this month’s receipts are due Friday. Please attach the invoice for any software subscription over $100.\n\nThank you,\nFinance", "INBOX"],
    ["Ari Morgan", "ari@northstarhq.com", "Launch brief and rollout checklist", "Hi Ari,\n\nI have shared the rollout checklist with the team. Let us use the review to settle the audience and support coverage.\n\nThanks", "SENT"],
    ["Leo Kim", "leo@seabound.ai", "Follow-up on access issue", "Hi Leo,\n\nThanks for flagging this. I am checking with the team and will bring an owner and a proposed resolution to our follow-up.\n\nBest", "SENT"],
    ["Priya Shah", "priya@vectorlane.com", "Re: Product designer interviews next week", "Hi Priya,\n\nTuesday afternoon works for me. I would like to join the final debrief; could you send the portfolio beforehand?\n\nThanks", "DRAFT"],
    ["Nadia Flores", "nadia@marketforge.co", "Re: Introduction: partnership with Marketforge", "Hi Nadia,\n\nThanks for reaching out. A short conversation sounds useful. I can share a few times once I have checked the team calendar.", "DRAFT"],
    ["Ari Morgan", "ari@northstarhq.com", "Customer feedback themes", "Hi,\n\nHere are the three recurring requests from recent calls: clearer ownership, faster search, and a simpler handoff. I will bring examples to the next planning session.\n\nAri", "INBOX STARRED"],
    ["Mika Patel", "mika@brightharbor.io", "Weekly operating notes", "Hi team,\n\nThe operating notes are ready. No decisions needed today; the document includes the latest hiring and customer updates.\n\nMika", "INBOX"]
    ,["Rosa Chen", "rosa@northstarhq.com", "Support coverage for launch day", "Hi,\n\nThe support team can cover the first two hours of the rollout. If we expand beyond the pilot group, we will need one more person on rotation.\n\nRosa", "INBOX UNREAD"]
    ,["Owen Brooks", "owen@northstarhq.com", "Onboarding pilot: results from this week", "Hi,\n\nSeven of eight pilot teams completed setup without help. The remaining team got stuck inviting colleagues; I have added the recording to the review notes.\n\nOwen", "INBOX STARRED"]
    ,["Samira Khan", "samira@northstarhq.com", "Can we move the roadmap review?", "Hi,\n\nThe customer call now overlaps with our roadmap review. Could we move it to tomorrow afternoon? I will update the agenda once we have a time.\n\nSamira", "INBOX UNREAD"]
    ,["Leo Kim", "leo@seabound.ai", "Re: workspace access", "Thanks for looking into this. The affected users are on our operations team, and both can still sign in to their Google accounts. Happy to walk through it on our call.\n\nLeo", "INBOX"]
    ,["Elena Park", "elena@northstarhq.com", "Renewal forecast for next quarter", "Hi,\n\nI have updated the renewal forecast with the latest customer notes. Two accounts need an executive check-in before we commit to the target.\n\nElena", "INBOX UNREAD"]
    ,["Priya Shah", "priya@vectorlane.com", "Portfolio review: panel notes", "Hi,\n\nI have collected the panel's questions and shared them with the candidate. Please add anything you want to cover before the interview.\n\nPriya", "INBOX"]
    ,["Nadia Flores", "nadia@marketforge.co", "Partnership overview", "Hi,\n\nFollowing up with a short overview of our customer community and the workshops we run. A joint session on inbox workflows could be a useful place to start.\n\nNadia", "INBOX"]
    ,["Rosa Chen", "rosa@northstarhq.com", "Help center updates for the pilot", "Hi,\n\nThe new setup guide is ready for a final pass. Could you check the section on inviting teammates before we publish it?\n\nRosa", "INBOX UNREAD"]
    ,["Owen Brooks", "owen@northstarhq.com", "Re: Onboarding pilot results", "Hi Owen,\n\nThanks for pulling this together. Please bring the invitation issue to the launch review so we can decide whether it blocks the pilot.\n\nThanks", "SENT"]
    ,["Samira Khan", "samira@northstarhq.com", "Re: Can we move the roadmap review?", "Hi Samira,\n\nTomorrow afternoon should work. I will check the calendar and send an updated invitation.\n\nThanks", "DRAFT"]
    ,["Elena Park", "elena@northstarhq.com", "Customer check-in notes", "Hi Elena,\n\nI can join the renewal conversation. Please send the account history and the outstanding questions ahead of the call.\n\nThanks", "SENT"]
    ,["Mika Patel", "mika@brightharbor.io", "Re: Board packet metrics", "Hi Mika,\n\nI will review the retention assumptions before our meeting. Could you also include the comparison with last quarter?\n\nThanks", "DRAFT"]
    ,["Community", "events@northstarhq.com", "Team offsite: collecting agenda ideas", "Hello everyone,\n\nWe are collecting topics for next month's offsite. Please send one question you would like the team to work through together.\n\nThanks", "INBOX"]
    ,["Rosa Chen", "rosa@northstarhq.com", "Customer feedback: search and ownership", "Hi,\n\nI grouped this week's support conversations into search, shared ownership, and scheduling. The examples are ready for our planning discussion.\n\nRosa", "INBOX STARRED"]
    ,["Mika Patel", "mika@brightharbor.io", "Investor update draft", "Hi,\n\nThe draft update is ready. The main open question is how much detail to share about the onboarding pilot before we have the full cohort results.\n\nMika", "INBOX UNREAD"]
    ,["Ari Morgan", "ari@northstarhq.com", "Pilot launch: final checklist", "Hi,\n\nThe checklist is almost complete. Can you confirm who will watch the support queue during the first hour?\n\nThanks,\nAri", "INBOX UNREAD"]
    ,["Rosa Chen", "rosa@northstarhq.com", "Support rota for the pilot", "Hi,\n\nI have pencilled in coverage for the morning. I will share the final rota after the launch review.\n\nThanks,\nRosa", "INBOX"]
    ,["Owen Brooks", "owen@northstarhq.com", "Invitation flow: proposed fix", "Hi,\n\nWe traced the invitation problem to a confusing confirmation step. The team has a small copy change ready for review.\n\nThanks,\nOwen", "INBOX UNREAD STARRED"]
    ,["Samira Khan", "samira@northstarhq.com", "Roadmap review: proposed agenda", "Hi,\n\nI suggest we start with the onboarding issue, then review the search feedback and ownership requests. Please add anything missing.\n\nThanks,\nSamira", "INBOX"]
    ,["Elena Park", "elena@northstarhq.com", "Renewal conversations this month", "Hi,\n\nBoth accounts are open to a check-in. One has asked for a clearer plan for shared inbox ownership.\n\nThanks,\nElena", "INBOX UNREAD"]
    ,["Leo Kim", "leo@seabound.ai", "Access issue resolved for one user", "Hi,\n\nOne teammate can now sign in again. The second is still seeing an error, so I will bring the details to our call.\n\nThanks,\nLeo", "INBOX UNREAD"]
    ,["Priya Shah", "priya@vectorlane.com", "Interview availability", "Hi,\n\nThe candidate has confirmed the portfolio review. I have left 15 minutes afterwards for panel notes.\n\nThanks,\nPriya", "INBOX"]
    ,["Nadia Flores", "nadia@marketforge.co", "Workshop audience and format", "Hi,\n\nOur community usually prefers a practical 30-minute session followed by questions. We could compare notes on a suitable topic.\n\nThanks,\nNadia", "INBOX"]
    ,["Mika Patel", "mika@brightharbor.io", "Retention numbers for the board", "Hi,\n\nThe latest cohort table is ready. The quarterly comparison is on the second page, with the assumptions underneath.\n\nThanks,\nMika", "INBOX STARRED"]
    ,["Rosa Chen", "rosa@northstarhq.com", "Help center guide: final edits", "Hi,\n\nI updated the invitation screenshots and clarified what happens when a teammate joins. Please review the opening paragraph.\n\nThanks,\nRosa", "INBOX UNREAD"]
    ,["Owen Brooks", "owen@northstarhq.com", "Pilot cohort feedback", "Hi,\n\nThree teams asked for a clearer way to see who owns a conversation. I have added their examples to the feedback notes.\n\nThanks,\nOwen", "INBOX"]
    ,["Samira Khan", "samira@northstarhq.com", "Planning notes from yesterday", "Hi,\n\nThanks for the discussion. We agreed to fix the invitation copy first and bring search improvements to the next roadmap review.\n\nThanks,\nSamira", "INBOX"]
    ,["Elena Park", "elena@northstarhq.com", "Account history before our call", "Hi,\n\nThe account expanded in the spring and their operations lead is our main contact. I have added the outstanding questions to the notes.\n\nThanks,\nElena", "INBOX"]
    ,["Ari Morgan", "ari@northstarhq.com", "Re: Pilot launch checklist", "Hi,\n\nHi Ari,\n\nRosa will cover the support queue for the first hour. I will confirm the backup during our review.\n\nThanks\n\nThanks,\nAri", "SENT"]
    ,["Rosa Chen", "rosa@northstarhq.com", "Re: Help center guide", "Hi,\n\nHi Rosa,\n\nThe updated guide reads clearly. I will check the opening paragraph and send you my notes today.\n\nThanks\n\nThanks,\nRosa", "SENT"]
    ,["Owen Brooks", "owen@northstarhq.com", "Re: Invitation flow", "Hi,\n\nHi Owen,\n\nThe copy change sounds promising. Could you share it with support before we roll it out?\n\nThanks\n\nThanks,\nOwen", "SENT"]
    ,["Elena Park", "elena@northstarhq.com", "Re: Renewal conversations", "Hi,\n\nHi Elena,\n\nI can join the account check-in. Please send the latest notes when the time is confirmed.\n\nThanks\n\nThanks,\nElena", "DRAFT"]
    ,["Leo Kim", "leo@seabound.ai", "Re: Access issue update", "Hi,\n\nHi Leo,\n\nGlad one user is back in. We will look at the remaining error together and agree a next update on the call.\n\nThanks,\nLeo", "DRAFT"]
    ,["Nadia Flores", "nadia@marketforge.co", "Re: Workshop audience", "Hi,\n\nHi Nadia,\n\nA practical session followed by questions sounds like a good fit. I will bring a few topic ideas to our introduction.\n\nThanks,\nNadia", "DRAFT"]
    ,["Priya Shah", "priya@vectorlane.com", "Re: Interview availability", "Hi,\n\nHi Priya,\n\nThanks for arranging the extra time. I will review the portfolio and add my questions before the session.\n\nThanks,\nPriya", "SENT"]
    ,["Mika Patel", "mika@brightharbor.io", "Next investor update: milestones", "Hi,\n\nCould you confirm the two milestones we should highlight? I would like to keep the update concise and include the pilot results once verified.\n\nThanks,\nMika", "INBOX UNREAD"]
    ,["Community", "events@northstarhq.com", "Offsite planning: themes so far", "Hi,\n\nThe most common suggestions are customer learning, decision making, and how we hand work between teams. We will share a draft agenda soon.\n\nThanks,\nCommunity", "INBOX"]
    ,["Ari Morgan", "ari@northstarhq.com", "Launch retrospective: notes to collect", "Hi,\n\nPlease add anything that slowed the pilot down or made the handoff easier. We will use the notes to prepare the retrospective.\n\nThanks,\nAri", "INBOX STARRED"]
    ,["Elena Park", "elena@northstarhq.com", "Renewal call: decision makers", "Hi,\n\nThe operations lead and their finance partner will join the renewal call. They asked for a brief recap of the improvements since their last review.\n\nElena", "INBOX UNREAD"]
    ,["Owen Brooks", "owen@northstarhq.com", "Pilot feedback: team invitations", "Hi,\n\nThe revised invitation copy tested well with two pilot teams. I will share the remaining feedback at the cohort check-in.\n\nOwen", "INBOX"]
    ,["Ari Morgan", "ari@northstarhq.com", "Re: Launch retrospective notes", "Hi Ari,\n\nI have added the support handoff and the invitation issue to the retrospective notes.\n\nThanks", "SENT"]
  ];
  const curatedThreads: ThreadDetail[] = curated.map(([sender, email, subject, body, state], index) => {
    const labels = state.split(" ");
    const outgoing = labels.includes("SENT") || labels.includes("DRAFT");
    const messageBody = outgoing && index >= 27 ? body.replace(/^Hi,\n\n/, "").replace(/\n\nThanks,\n[^\n]+$/, "") : body;
    const receivedAt = makeDemoDate(-30 - index * 180).toISOString();
    const threadId = `demo-v2-thread-${index + 1}`;
    const message = makeDemoMessage({ id: `${threadId}-message-1`, from: outgoing ? `${env.DEMO_DISPLAY_NAME} <${env.DEMO_EMAIL}>` : `${sender} <${email}>`, to: outgoing ? `${sender} <${email}>` : env.DEMO_EMAIL, subject, body: messageBody, snippet: messageBody.slice(0, 120), receivedAt, labels });
    return { threadId, subject, sender: outgoing ? env.DEMO_DISPLAY_NAME : sender, senderEmail: outgoing ? env.DEMO_EMAIL : email, recipients: [outgoing ? email : env.DEMO_EMAIL], snippet: messageBody.slice(0, 140), bodyExcerpt: messageBody.slice(0, 200), receivedAt, messageCount: 1, labels, unread: labels.includes("UNREAD"), starred: labels.includes("STARRED"), archived: false, priorityBand: index < 3 ? "high" : "normal", priorityScore: index < 3 ? 90 : 55, priorityReason: index < 3 ? "Needs a decision or follow-up." : "Conversation for review.", body: messageBody, htmlBody: message.htmlBody, messages: [message] };
  });
  return curatedThreads;
}

function buildDemoEvents(): AgendaEvent[] {
  const events = [
    ["Launch review", "Confirm the rollout audience, support coverage, and the onboarding invitation issue.", "ari@northstarhq.com", 0, 120],
    ["Seabound customer follow-up", "Agree an owner and update time for the workspace access issue.", "leo@seabound.ai", 0, 300],
    ["Board packet review", "Review retention assumptions and the comparison with last quarter.", "mika@brightharbor.io", 1, 60],
    ["Product designer portfolio review", "Discuss the candidate's work and collect the panel's questions.", "priya@vectorlane.com", 1, 270],
    ["Roadmap review", "Prioritize the onboarding, search, and shared ownership work.", "samira@northstarhq.com", 2, 120],
    ["Support launch readiness", "Review the help center guide and the launch-day coverage rota.", "rosa@northstarhq.com", 2, 300],
    ["Onboarding pilot debrief", "Review completion rates and the team invitation issue.", "owen@northstarhq.com", 3, 90],
    ["Renewal forecast", "Discuss the two accounts that need an executive check-in.", "elena@northstarhq.com", 3, 270],
    ["Marketforge introduction", "Explore a joint workshop for operations teams.", "nadia@marketforge.co", 4, 120],
    ["Hiring debrief", "Compare panel feedback and agree on next steps for the candidate.", "priya@vectorlane.com", 4, 300],
    ["Weekly operating review", "Check progress on customer issues, hiring, and the launch.", "mika@brightharbor.io", 5, 90],
    ["Customer feedback synthesis", "Review examples of search and ownership requests.", "rosa@northstarhq.com", 5, 270],
    ["Investor update review", "Decide what pilot results to include in the next update.", "mika@brightharbor.io", 6, 120],
    ["Launch retrospective", "Capture what worked during the pilot and assign follow-ups.", "ari@northstarhq.com", 7, 120],
    ["Customer renewal check-in", "Review account history and open questions before renewal.", "elena@northstarhq.com", 8, 270],
    ["Offsite planning", "Choose the questions and working sessions for next month's team offsite.", "samira@northstarhq.com", 9, 120],
    ["Pilot cohort check-in", "Review adoption and collect feedback from the pilot teams.", "owen@northstarhq.com", 10, 270],
    ["Partnership workshop planning", "Outline the audience and format for a possible joint session.", "nadia@marketforge.co", 11, 120],
    ["Hiring pipeline review", "Review upcoming interviews and candidate communications.", "priya@vectorlane.com", 12, 270],
    ["Monthly planning", "Agree the next month's priorities and owners.", "ari@northstarhq.com", 13, 120],
    ["Invitation copy review", "Review the revised invitation copy and pilot feedback.", "owen@northstarhq.com", 14, 120],
    ["Renewal preparation", "Prepare the recap of improvements for the customer decision makers.", "elena@northstarhq.com", 15, 270],
    ["Support handoff review", "Review the launch support handoff and agree improvements.", "rosa@northstarhq.com", 16, 120],
  ] satisfies [string, string, string, number, number][];
  return events.map(([summary, description, attendee, day, minute], index) => {
    const id = `demo-v2-event-${index + 1}`;
    return { id, summary, description, location: index % 3 === 0 ? "Conference room" : "Google Meet", start: makeDemoDate(day * 1440 + minute).toISOString(), end: makeDemoDate(day * 1440 + minute + 45).toISOString(), attendees: [attendee, env.DEMO_EMAIL], status: "confirmed", htmlLink: demoCalendarLink(id) };
  });
}

async function seedDemoWorkspaceIfNeeded(tenantId: string) {
  const session = buildDemoSession();
  session.tenantId = tenantId;

  try {
    const db = await appDb();
    await upsertProfile(session);
    const marker = await db`SELECT 1 FROM email_thread_cache WHERE tenant_id = ${tenantId} AND thread_id = 'demo-v2-thread-1' LIMIT 1`;
    if (marker.length === 0) {
      await db`DELETE FROM email_thread_cache WHERE tenant_id = ${tenantId} AND (thread_id LIKE 'demo-thread-%' OR thread_id LIKE 'demo-curated-%')`;
      await db`DELETE FROM calendar_event_cache WHERE tenant_id = ${tenantId} AND event_id LIKE 'demo-event-%'`;
      for (const thread of buildDemoThreads().slice(1)) await writeThreadSummary(tenantId, thread);
      await writeCalendarEvents(tenantId, buildDemoEvents());
      await writeThreadSummary(tenantId, buildDemoThreads()[0]);
    }

    const expansion = await db`SELECT 1 FROM email_thread_cache WHERE tenant_id = ${tenantId} AND thread_id = 'demo-v2-thread-53' LIMIT 1`;
    if (expansion.length === 0) {
      for (const thread of buildDemoThreads().slice(27)) {
        const existing = await db`SELECT 1 FROM email_thread_cache WHERE tenant_id = ${tenantId} AND thread_id = ${thread.threadId} LIMIT 1`;
        if (existing.length === 0) await writeThreadSummary(tenantId, thread);
      }
    }

    const eventExpansion = await db`SELECT 1 FROM calendar_event_cache WHERE tenant_id = ${tenantId} AND event_id = 'demo-v2-event-23' LIMIT 1`;
    if (eventExpansion.length === 0) {
      for (const event of buildDemoEvents().slice(20)) {
        const existing = await db`SELECT 1 FROM calendar_event_cache WHERE tenant_id = ${tenantId} AND event_id = ${event.id} LIMIT 1`;
        if (existing.length === 0) await writeCalendarEvents(tenantId, [event]);
      }
    }

    await writeSyncState(tenantId, "inbox");
    await writeSyncState(tenantId, "calendar");
  } catch (error) {
    getDemoMemoryWorkspace(tenantId);
    log.warn("demo_seed_fallback_to_memory", { tenantId, error });
  }
}

async function writeThreadSummary(tenantId: string, detail: ThreadDetail) {
  if (isDemoTenant(tenantId)) {
    const workspace = getDemoMemoryWorkspace(tenantId);
    const priority = classifyPriority(detail);
    const persisted = {
      ...detail,
      ...priority,
    };
    workspace.threads.set(detail.threadId, persisted);
  }

  try {
    const db = await drizzleDb();
    const priority = classifyPriority(detail);
    const timestamp = now();
    const values = {
      tenantId,
      threadId: detail.threadId,
      subject: detail.subject,
      sender: detail.sender,
      senderEmail: detail.senderEmail,
      recipients: JSON.stringify(detail.recipients),
      snippet: detail.snippet,
      bodyExcerpt: detail.bodyExcerpt,
      bodyText: detail.body,
      htmlBody: detail.htmlBody,
      messagesJson: detail.messages,
      receivedAt: toTimestamp(detail.receivedAt),
      messageCount: detail.messageCount,
      labelsJson: JSON.stringify(detail.labels),
      unread: detail.unread,
      starred: detail.starred,
      archived: detail.archived,
      priorityBand: priority.priorityBand,
      priorityScore: priority.priorityScore,
      priorityReason: priority.priorityReason,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await db
      .insert(schema.emailThreadCache)
      .values(values)
      .onConflictDoUpdate({
        target: [
          schema.emailThreadCache.tenantId,
          schema.emailThreadCache.threadId,
        ],
        set: {
          subject: values.subject,
          sender: values.sender,
          senderEmail: values.senderEmail,
          recipients: values.recipients,
          snippet: values.snippet,
          bodyExcerpt: values.bodyExcerpt,
          bodyText: values.bodyText,
          htmlBody: values.htmlBody,
          messagesJson: values.messagesJson,
          receivedAt: values.receivedAt,
          messageCount: values.messageCount,
          labelsJson: values.labelsJson,
          unread: values.unread,
          starred: values.starred,
          archived: values.archived,
          priorityBand: values.priorityBand,
          priorityScore: values.priorityScore,
          priorityReason: values.priorityReason,
          updatedAt: values.updatedAt,
        },
      });

    return {
      ...detail,
      ...priority,
    };
  } catch (error) {
    if (!isDemoTenant(tenantId)) throw error;
    log.warn("demo_write_fallback_to_memory", {
      tenantId,
      operation: "writeThreadSummary",
      error,
    });
    return { ...detail, ...classifyPriority(detail) };
  }
}

function mapThreadRow(row: ThreadCacheRow): ThreadSummary {
  const normalized = normalizeThreadRow(row);

  return {
    threadId: normalized.threadId,
    subject: normalized.subject ?? "(No subject)",
    sender: normalized.sender ?? "",
    senderEmail: normalized.senderEmail ?? "",
    recipients: parseStringArray(normalized.recipients),
    snippet: normalized.snippet ?? "",
    bodyExcerpt: normalized.bodyExcerpt ?? "",
    receivedAt: toIsoString(normalized.receivedAt),
    messageCount: Number(normalized.messageCount ?? 0),
    labels: parseStringArray(normalized.labelsJson),
    unread: toBoolean(normalized.unread),
    starred: toBoolean(normalized.starred),
    archived: toBoolean(normalized.archived),
    priorityBand: toPriorityBand(normalized.priorityBand),
    priorityScore: Number(normalized.priorityScore ?? 0),
    priorityReason: normalized.priorityReason ?? "",
  };
}

function mapThreadDetailRow(row: ThreadCacheRow): ThreadDetail {
  const normalized = normalizeThreadRow(row);
  const summary = mapThreadRow(normalized);
  const messages = parseMessages(normalized.messagesJson);
  const body = normalized.bodyText ?? summary.bodyExcerpt;
  const fallbackMessage: ThreadDetail["messages"][number] = {
    id: normalized.threadId,
    from: normalized.sender ?? "",
    to: parseStringArray(normalized.recipients).join(", "),
    subject: normalized.subject ?? "(No subject)",
    snippet: normalized.snippet ?? "",
    body,
    htmlBody: normalized.htmlBody ?? null,
    receivedAt: toIsoString(normalized.receivedAt),
    labels: parseStringArray(normalized.labelsJson),
  };

  return {
    ...summary,
    body,
    htmlBody: normalized.htmlBody ?? null,
    messages: messages.length > 0 ? messages : [fallbackMessage],
  };
}

function mapThreadSummaryRow(row: ThreadSummaryRow): ThreadSummary {
  return {
    threadId: row.threadId,
    subject: row.subject ?? "(No subject)",
    sender: row.sender ?? "",
    senderEmail: row.senderEmail ?? "",
    recipients: parseStringArray(row.recipients),
    snippet: row.snippet ?? "",
    bodyExcerpt: row.bodyExcerpt ?? "",
    receivedAt: toIsoString(row.receivedAt),
    messageCount: Number(row.messageCount ?? 0),
    labels: parseStringArray(row.labelsJson),
    unread: toBoolean(row.unread),
    starred: toBoolean(row.starred),
    archived: toBoolean(row.archived),
    priorityBand: toPriorityBand(row.priorityBand),
    priorityScore: Number(row.priorityScore ?? 0),
    priorityReason: row.priorityReason ?? "",
  };
}

async function countCachedThreads(tenantId: string) {
  if (isDemoTenant(tenantId)) {
    await seedDemoWorkspaceIfNeeded(tenantId);
    return getDemoMemoryWorkspace(tenantId).threads.size;
  }

  const db = await appDb();
  const rows = await db<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM email_thread_cache
    WHERE tenant_id = ${tenantId}
  `;
  return Number(rows[0]?.count ?? "0");
}

async function readThreadSummariesPage(
  tenantId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const limit = Math.max(1, options.limit ?? INITIAL_WORKSPACE_THREAD_PAGE_SIZE);
  const offset = Math.max(0, options.offset ?? 0);

  if (isDemoTenant(tenantId)) {
    await seedDemoWorkspaceIfNeeded(tenantId);
  }

  try {
    if (isDemoTenant(tenantId)) {
      const allThreads = sortDemoThreads(Array.from(getDemoMemoryWorkspace(tenantId).threads.values())).map((thread) => ({
        threadId: thread.threadId,
        subject: thread.subject,
        sender: thread.sender,
        senderEmail: thread.senderEmail,
        recipients: thread.recipients,
        snippet: thread.snippet,
        bodyExcerpt: thread.bodyExcerpt,
        receivedAt: thread.receivedAt,
        messageCount: thread.messageCount,
        labels: thread.labels,
        unread: thread.unread,
        starred: thread.starred,
        archived: thread.archived,
        priorityBand: thread.priorityBand,
        priorityScore: thread.priorityScore,
        priorityReason: thread.priorityReason,
      }));

      const threads = allThreads.slice(offset, offset + limit);
      return {
        threads,
        total: allThreads.length,
        limit,
        offset,
        hasMore: offset + threads.length < allThreads.length,
        nextOffset: offset + threads.length < allThreads.length ? offset + threads.length : null,
      };
    }

    const db = await drizzleDb();
    const rows = await db
      .select({
        threadId: schema.emailThreadCache.threadId,
        subject: schema.emailThreadCache.subject,
        sender: schema.emailThreadCache.sender,
        senderEmail: schema.emailThreadCache.senderEmail,
        recipients: schema.emailThreadCache.recipients,
        snippet: schema.emailThreadCache.snippet,
        bodyExcerpt: schema.emailThreadCache.bodyExcerpt,
        receivedAt: schema.emailThreadCache.receivedAt,
        messageCount: schema.emailThreadCache.messageCount,
        labelsJson: schema.emailThreadCache.labelsJson,
        unread: schema.emailThreadCache.unread,
        starred: schema.emailThreadCache.starred,
        archived: schema.emailThreadCache.archived,
        priorityBand: schema.emailThreadCache.priorityBand,
        priorityScore: schema.emailThreadCache.priorityScore,
        priorityReason: schema.emailThreadCache.priorityReason,
      })
      .from(schema.emailThreadCache)
      .where(eq(schema.emailThreadCache.tenantId, tenantId))
      .orderBy(sql`${schema.emailThreadCache.receivedAt} DESC NULLS LAST`, schema.emailThreadCache.threadId)
      .limit(limit)
      .offset(offset);

    const total = await countCachedThreads(tenantId);
    const threads = rows.map(mapThreadSummaryRow);
    return {
      threads,
      total,
      limit,
      offset,
      hasMore: offset + threads.length < total,
      nextOffset: offset + threads.length < total ? offset + threads.length : null,
    };
  } catch (error) {
    if (!isDemoTenant(tenantId)) {
      throw error;
    }
    log.warn("demo_thread_read_fallback_to_memory", { tenantId, error });
    const fallbackThreads = sortDemoThreads(Array.from(getDemoMemoryWorkspace(tenantId).threads.values())).map((thread) => ({
      threadId: thread.threadId,
      subject: thread.subject,
      sender: thread.sender,
      senderEmail: thread.senderEmail,
      recipients: thread.recipients,
      snippet: thread.snippet,
      bodyExcerpt: thread.bodyExcerpt,
      receivedAt: thread.receivedAt,
      messageCount: thread.messageCount,
      labels: thread.labels,
      unread: thread.unread,
      starred: thread.starred,
      archived: thread.archived,
      priorityBand: thread.priorityBand,
      priorityScore: thread.priorityScore,
      priorityReason: thread.priorityReason,
    }));
    const threads = fallbackThreads.slice(offset, offset + limit);
    return {
      threads,
      total: fallbackThreads.length,
      limit,
      offset,
      hasMore: offset + threads.length < fallbackThreads.length,
      nextOffset: offset + threads.length < fallbackThreads.length ? offset + threads.length : null,
    };
  }
}

async function readThreadSummaries(tenantId: string) {
  const page = await readThreadSummariesPage(tenantId, { limit: GMAIL_SYNC_THREAD_LIMIT, offset: 0 });
  return page.threads;
}

async function readThreadDetailFromCache(tenantId: string, threadId: string) {
  if (isDemoTenant(tenantId)) {
    await seedDemoWorkspaceIfNeeded(tenantId);
  }
  try {
    const db = await drizzleDb();
    const row = await db.query.emailThreadCache.findFirst({
      where: and(eq(schema.emailThreadCache.tenantId, tenantId), eq(schema.emailThreadCache.threadId, threadId)),
    });

    if (!row) {
      return null;
    }

    return mapThreadDetailRow(row);
  } catch (error) {
    if (!isDemoTenant(tenantId)) {
      throw error;
    }
    log.warn("demo_thread_detail_fallback_to_memory", { tenantId, threadId, error });
    return getDemoMemoryWorkspace(tenantId).threads.get(threadId) ?? null;
  }
}

async function repairThreadBodies(tenantId: string, threads: ThreadSummary[]) {
  if (isDemoTenant(tenantId)) {
    return;
  }
  const missing = threads.filter((thread) => !thread.bodyExcerpt && !thread.snippet);
  if (missing.length === 0) {
    return;
  }

  await Promise.all(
    missing.slice(0, 10).map(async (thread) => {
      await getThreadDetail(tenantId, thread.threadId, { refresh: true });
    }),
  );
}

async function isBackgroundInboxSyncing(tenantId: string) {
  if (isDemoTenant(tenantId)) return false;
  const db = await drizzleDb();
  const cursor = await db.query.inboxSyncCursor.findFirst({ where: eq(schema.inboxSyncCursor.tenantId, tenantId) });
  return cursor ? Boolean(cursor.nextPageToken) : Boolean(await readSyncState(tenantId, "inbox"));
}

/**
 * Lightning Search: sub-second local full-text search over the Postgres thread
 * cache (no Gmail round-trip). Ranked by ts_rank, then priority. Empty query
 * returns the full priority-ordered list.
 */
export async function searchThreadsLocal(tenantId: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return readThreadSummaries(tenantId);
  }

  if (isDemoTenant(tenantId)) {
    await seedDemoWorkspaceIfNeeded(tenantId);
    try {
      const db = await appDb();
      const rows = await db<ThreadCacheRow[]>`
        SELECT
          thread_id, subject, sender, sender_email, recipients, snippet, body_excerpt,
          body_text, html_body, messages_json, received_at, message_count, labels_json,
          unread, starred, archived, priority_band, priority_score, priority_reason
        FROM email_thread_cache
        WHERE tenant_id = ${tenantId}
          AND search_tsv @@ websearch_to_tsquery('english', ${trimmed})
        ORDER BY
          ts_rank(search_tsv, websearch_to_tsquery('english', ${trimmed})) DESC,
          priority_score DESC,
          received_at DESC NULLS LAST
        LIMIT 50
      `;

      return rows.map(mapThreadRow);
    } catch (error) {
      log.warn("demo_search_fallback_to_memory", { tenantId, query: trimmed, error });
      const needle = trimmed.toLowerCase();
      return sortDemoThreads(Array.from(getDemoMemoryWorkspace(tenantId).threads.values()))
        .filter((thread) =>
          [
            thread.subject,
            thread.sender,
            thread.senderEmail,
            thread.snippet,
            thread.bodyExcerpt,
            thread.body,
            thread.recipients.join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle),
        )
        .slice(0, 50)
        .map((thread) => ({
          threadId: thread.threadId,
          subject: thread.subject,
          sender: thread.sender,
          senderEmail: thread.senderEmail,
          recipients: thread.recipients,
          snippet: thread.snippet,
          bodyExcerpt: thread.bodyExcerpt,
          receivedAt: thread.receivedAt,
          messageCount: thread.messageCount,
          labels: thread.labels,
          unread: thread.unread,
          starred: thread.starred,
          archived: thread.archived,
          priorityBand: thread.priorityBand,
          priorityScore: thread.priorityScore,
          priorityReason: thread.priorityReason,
        }));
    }
  }

  const db = await appDb();
  const rows = await db<ThreadCacheRow[]>`
    SELECT
      thread_id, subject, sender, sender_email, recipients, snippet, body_excerpt,
      body_text, html_body, messages_json, received_at, message_count, labels_json,
      unread, starred, archived, priority_band, priority_score, priority_reason
    FROM email_thread_cache
    WHERE tenant_id = ${tenantId}
      AND search_tsv @@ websearch_to_tsquery('english', ${trimmed})
    ORDER BY
      ts_rank(search_tsv, websearch_to_tsquery('english', ${trimmed})) DESC,
      priority_score DESC,
      received_at DESC NULLS LAST
    LIMIT 50
  `;

  return rows.map(mapThreadRow);
}

export async function triageInbox(tenantId: string, input: InboxTriageInput) {
  const query = input.query?.trim() ?? "";
  const threads =
    input.mode === "summarize_threads" && query
      ? await searchThreadsLocal(tenantId, query)
      : await readThreadSummaries(tenantId);

  return triageThreads(threads, input);
}

async function writeCalendarEvents(tenantId: string, events: AgendaEvent[]) {
  if (isDemoTenant(tenantId)) {
    const workspace = getDemoMemoryWorkspace(tenantId);
    for (const event of events) {
      workspace.events.set(event.id, event);
    }
  }

  try {
    const db = await drizzleDb();
    const timestamp = now();

    for (const event of events) {
      const values = {
        tenantId,
        eventId: event.id,
        summary: event.summary,
        description: event.description,
        location: event.location,
        startAt: toTimestamp(event.start),
        endAt: toTimestamp(event.end),
        startValue: event.start,
        endValue: event.end,
        attendeesJson: JSON.stringify(event.attendees),
        status: event.status,
        htmlLink: event.htmlLink,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await db
        .insert(schema.calendarEventCache)
        .values(values)
        .onConflictDoUpdate({
          target: [
            schema.calendarEventCache.tenantId,
            schema.calendarEventCache.eventId,
          ],
          set: {
            summary: values.summary,
            description: values.description,
            location: values.location,
            startAt: values.startAt,
            endAt: values.endAt,
            startValue: values.startValue,
            endValue: values.endValue,
            attendeesJson: values.attendeesJson,
            status: values.status,
            htmlLink: values.htmlLink,
            updatedAt: values.updatedAt,
          },
        });
    }

    return events;
  } catch (error) {
    if (!isDemoTenant(tenantId)) throw error;
    log.warn("demo_write_fallback_to_memory", {
      tenantId,
      operation: "writeCalendarEvents",
      error,
    });
    return events;
  }
}

function mapCalendarRow(row: CalendarCacheRow): AgendaEvent {
  const normalized = normalizeCalendarRow(row);

  return {
    id: normalized.eventId,
    summary: normalized.summary ?? "Untitled event",
    description: normalized.description ?? "",
    location: normalized.location ?? "",
    start: normalized.startValue,
    end: normalized.endValue,
    attendees: parseStringArray(normalized.attendeesJson),
    status: toEventStatus(normalized.status),
    htmlLink: normalized.htmlLink,
  };
}

async function readCalendarEventsLocal(tenantId: string, query = "") {
  if (isDemoTenant(tenantId)) {
    await seedDemoWorkspaceIfNeeded(tenantId);
  }
  const trimmed = query.trim();

  try {
    const db = await appDb();

    if (!trimmed) {
      const drizzle = await drizzleDb();
      const rows = await drizzle.query.calendarEventCache.findMany({
        where: eq(schema.calendarEventCache.tenantId, tenantId),
        orderBy: sql`${schema.calendarEventCache.startAt} ASC NULLS LAST`,
        limit: 100,
      });

      return rows.map(mapCalendarRow);
    }

    const rows = await db<CalendarCacheRow[]>`
      SELECT
        event_id, summary, description, location, start_value, end_value,
        attendees_json, status, html_link
      FROM calendar_event_cache
      WHERE tenant_id = ${tenantId}
        AND search_tsv @@ websearch_to_tsquery('english', ${trimmed})
      ORDER BY
        ts_rank(search_tsv, websearch_to_tsquery('english', ${trimmed})) DESC,
        start_at ASC NULLS LAST
      LIMIT 50
    `;

    return rows.map(mapCalendarRow);
  } catch (error) {
    if (!isDemoTenant(tenantId)) {
      throw error;
    }
    log.warn("demo_calendar_read_fallback_to_memory", { tenantId, query: trimmed, error });
    const events = sortDemoEvents(Array.from(getDemoMemoryWorkspace(tenantId).events.values()));
    if (!trimmed) {
      return events.slice(0, 100);
    }
    const needle = trimmed.toLowerCase();
    return events.filter((event) =>
      [event.summary, event.description, event.location, event.attendees.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    ).slice(0, 50);
  }
}

async function writeSyncState(tenantId: string, resource: SyncResource) {
  if (isDemoTenant(tenantId)) {
    touchDemoSyncState(tenantId, resource);
  }
  try {
    const db = await drizzleDb();
    const syncedAt = now();

    await db
      .insert(schema.syncState)
      .values({ tenantId, resource, syncedAt })
      .onConflictDoUpdate({
        target: [schema.syncState.tenantId, schema.syncState.resource],
        set: { syncedAt },
      });
  } catch (error) {
    if (!isDemoTenant(tenantId)) throw error;
    log.warn("demo_write_fallback_to_memory", {
      tenantId,
      operation: "writeSyncState",
      error,
    });
  }
}

async function readSyncState(tenantId: string, resource: SyncResource) {
  try {
    const db = await drizzleDb();
    const row = await db.query.syncState.findFirst({
      where: and(eq(schema.syncState.tenantId, tenantId), eq(schema.syncState.resource, resource)),
    });

    return toIsoString(row?.syncedAt);
  } catch (error) {
    if (!isDemoTenant(tenantId)) {
      throw error;
    }
    log.warn("demo_sync_state_fallback_to_memory", { tenantId, resource, error });
    return getDemoMemoryWorkspace(tenantId).syncedAt[resource];
  }
}

/**
 * Lightweight sync-timestamp snapshot for the client polling fallback. The
 * browser compares this to its last-seen values and only reloads the full
 * workspace when something actually changed.
 */
export async function getSyncStatus(tenantId: string) {
  const [inbox, calendar] = await Promise.all([
    readSyncState(tenantId, "inbox"),
    readSyncState(tenantId, "calendar"),
  ]);

  return { inbox, calendar };
}

async function tenantCredentialsForStatus(integrationName: "gmail" | "googlecalendar", tenantId: string) {
  try {
    const database = createCorsairDatabase(await getAppDb());
    const accountKm = createAccountKeyManager({
      authType: "oauth_2",
      integrationName,
      tenantId,
      kek: env.CORSAIR_KEK,
      database,
    });

    const refreshToken = await accountKm.get_refresh_token();
    return {
      authorized: Boolean(refreshToken),
    };
  } catch (error) {
    log.warn("connection_status_read_failed", { tenantId, integrationName, error });
    return {
      authorized: false,
    };
  }
}

export async function getStoredConnectionStatus(tenantId: string, setupLog = ""): Promise<ConnectionStatus> {
  if (isDemoTenant(tenantId)) {
    const connected: ProviderStatus = {
      authorized: true,
      healthy: true,
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
      lastError: null,
    };

    return {
      gmail: connected,
      calendar: connected,
      readyForWorkspace: true,
      degraded: false,
      setupLog,
    };
  }

  const [gmailAccount, calendarAccount] = await Promise.all([
    tenantCredentialsForStatus("gmail", tenantId),
    tenantCredentialsForStatus("googlecalendar", tenantId),
  ]);

  const gmail: ProviderStatus = {
    authorized: gmailAccount.authorized,
    healthy: null,
    checkedAt: null,
    latencyMs: null,
    lastError: null,
  };
  const calendar: ProviderStatus = {
    authorized: calendarAccount.authorized,
    healthy: null,
    checkedAt: null,
    latencyMs: null,
    lastError: null,
  };

  return {
    gmail,
    calendar,
    readyForWorkspace: gmail.authorized && calendar.authorized,
    degraded: false,
    setupLog,
  };
}

export async function ensureTenant(session: SessionUser) {
  await upsertProfile(session);

  if (isDemoSessionLike(session)) {
    await seedDemoWorkspaceIfNeeded(session.tenantId);
    return "Demo workspace ready.";
  }

  const client = await corsair();
  const setupStartedAt = Date.now();
  const setupLog = await withTimeout(
    setupCorsair(client, {
      tenantId: session.tenantId,
    }),
    SETUP_TIMEOUT_MS,
    "corsair setup",
  );

  try {
    const seededCredentials = await withTimeout(
      ensureIntegrationCredentials(),
      SETUP_TIMEOUT_MS,
      "integration credential setup",
    );

    if (!seededCredentials) {
      return setupLog;
    }

    return withTimeout(
      setupCorsair(client, {
        tenantId: session.tenantId,
      }),
      SETUP_TIMEOUT_MS,
      "corsair setup after credential seed",
    );
  } catch (error) {
    log.warn("tenant_setup_followup_failed", { tenantId: session.tenantId, error });
    return setupLog;
  } finally {
    log.info("tenant_bootstrap_timing", { tenantId: session.tenantId, durationMs: Date.now() - setupStartedAt });
  }
}

export async function getConnectionHealth(tenantId: string, setupLog = ""): Promise<ConnectionStatus> {
  const status = await getStoredConnectionStatus(tenantId, setupLog);
  if (isDemoTenant(tenantId)) {
    return status;
  }
  if (!status.gmail.authorized && !status.calendar.authorized) {
    return status;
  }

  const tenant = await tenantClient(tenantId);
  const [gmail, calendar] = await Promise.all([
    settleProviderStatus(
      "gmail labels",
      status.gmail.authorized,
      () => tenant.gmail.api.labels.list({ userId: "me" }),
      CONNECTION_CHECK_TIMEOUT_MS,
    ),
    settleProviderStatus(
      "calendar events",
      status.calendar.authorized,
      () =>
        tenant.googlecalendar.api.events.getMany({
          calendarId: "primary",
          timeMin: new Date().toISOString(),
          maxResults: 1,
          singleEvents: true,
          orderBy: "startTime",
        }),
      CONNECTION_CHECK_TIMEOUT_MS,
    ),
  ]);

  log.info("provider_health_probe_timing", {
    tenantId,
    provider: "gmail",
    authorized: gmail.authorized,
    healthy: gmail.healthy,
    latencyMs: gmail.latencyMs,
    checkedAt: gmail.checkedAt,
    lastError: gmail.lastError,
  });
  log.info("provider_health_probe_timing", {
    tenantId,
    provider: "calendar",
    authorized: calendar.authorized,
    healthy: calendar.healthy,
    latencyMs: calendar.latencyMs,
    checkedAt: calendar.checkedAt,
    lastError: calendar.lastError,
  });

  return {
    gmail,
    calendar,
    readyForWorkspace: status.readyForWorkspace,
    degraded: (gmail.authorized && gmail.healthy === false) || (calendar.authorized && calendar.healthy === false),
    setupLog,
  };
}

async function fetchGmailThreadIds(
  tenant: Awaited<ReturnType<typeof tenantClient>>,
  query: string,
  limit: number,
  startPageToken?: string,
) {
  return collectGmailThreadIds({
    limit,
    startPageToken,
    listPage: ({ maxResults, pageToken }) => tenant.gmail.api.threads.list({
      userId: "me",
      q: query || undefined,
      maxResults,
      pageToken,
      includeSpamTrash: false,
    }),
  });
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));

  return results;
}

export async function refreshInbox(
  tenantId: string,
  query = "",
  options: { limit?: number; publish?: boolean } = {},
) {
  if (isDemoTenant(tenantId)) {
    return query ? searchThreadsLocal(tenantId, query) : readThreadSummaries(tenantId);
  }

  const tenant = await tenantClient(tenantId);
  const limit = options.limit ?? (query ? GMAIL_SEARCH_THREAD_LIMIT : GMAIL_SYNC_THREAD_LIMIT);
  const { ids: threadIds, nextPageToken } = await fetchGmailThreadIds(tenant, query, limit);

  const details = await mapConcurrent(threadIds, GMAIL_DETAIL_CONCURRENCY, async (id) => {
    const fullThread = await tenant.gmail.api.threads.get({
      userId: "me",
      id,
      format: "full",
      metadataHeaders: ["From", "To", "Subject", "Date"],
    });

    return writeThreadSummary(tenantId, normalizeThread(fullThread));
  });

  if (!query) {
    const db = await drizzleDb();
    // A recent-mail refresh must not reset an older-mail backfill cursor.
    await db.insert(schema.inboxSyncCursor).values({ tenantId, nextPageToken }).onConflictDoNothing();
  }
  await writeSyncState(tenantId, "inbox");
  if (options.publish !== false) {
    publishRefresh(tenantId);
  }

  return details.sort((left, right) => (right.receivedAt ?? "").localeCompare(left.receivedAt ?? "") || left.threadId.localeCompare(right.threadId));
}

export async function refreshCalendar(tenantId: string) {
  if (isDemoTenant(tenantId)) {
    return readCalendarEventsLocal(tenantId);
  }

  const tenant = await tenantClient(tenantId);
  const events: AgendaEvent[] = [];
  let pageToken: string | undefined;

  do {
    const response = await tenant.googlecalendar.api.events.getMany({
      calendarId: "primary",
      maxResults: Math.min(CALENDAR_PAGE_SIZE, CALENDAR_SYNC_EVENT_LIMIT - events.length),
      pageToken,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: new Date().toISOString(),
    });

    events.push(...((response.items ?? []).map(asAgendaEvent)));
    pageToken = response.nextPageToken;
  } while (pageToken && events.length < CALENDAR_SYNC_EVENT_LIMIT);

  await writeCalendarEvents(tenantId, events);
  await writeSyncState(tenantId, "calendar");

  return events;
}

export async function getThreadDetail(tenantId: string, threadId: string, options: { refresh?: boolean } = {}) {
  if (isDemoTenant(tenantId)) {
    const cached = await readThreadDetailFromCache(tenantId, threadId);
    if (cached) {
      return cached;
    }
    throw new Error("Demo thread not found.");
  }

  if (!options.refresh) {
    const cached = await readThreadDetailFromCache(tenantId, threadId);
    if (cached?.messages.length) {
      return cached;
    }
  }

  const tenant = await tenantClient(tenantId);
  const thread = await tenant.gmail.api.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
    metadataHeaders: ["From", "To", "Subject", "Date"],
  });

  return writeThreadSummary(tenantId, normalizeThread(thread));
}

export async function expandInboxCache(tenantId: string, options: { target?: number } = {}) {
  if (isDemoTenant(tenantId)) {
    return {
      cachedThreads: await countCachedThreads(tenantId),
      target: options.target ?? BACKGROUND_SYNC_TARGET,
    };
  }

  const db = await drizzleDb();
  // Serialize continuation per tenant, including across server instances.
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`);
    const cursor = await tx.query.inboxSyncCursor.findFirst({ where: eq(schema.inboxSyncCursor.tenantId, tenantId) });
    if (cursor && !cursor.nextPageToken) return;
    const tenant = await tenantClient(tenantId);
    const cached = cursor ? [] : await tx.select({ threadId: schema.emailThreadCache.threadId })
      .from(schema.emailThreadCache).where(eq(schema.emailThreadCache.tenantId, tenantId));
    const knownIds = new Set(cached.map(thread => thread.threadId));
    // Existing accounts may have a cache created before continuation was saved.
    const { ids, nextPageToken } = await fetchGmailThreadIds(
      tenant, "", BACKGROUND_SYNC_BATCH_SIZE + cached.length, cursor?.nextPageToken ?? undefined,
    );
    await mapConcurrent(ids.filter(id => !knownIds.has(id)), GMAIL_DETAIL_CONCURRENCY, async (id) => {
      const thread = await tenant.gmail.api.threads.get({ userId: "me", id, format: "full" });
      await writeThreadSummary(tenantId, normalizeThread(thread));
    });
    await tx.insert(schema.inboxSyncCursor).values({ tenantId, nextPageToken }).onConflictDoUpdate({
      target: schema.inboxSyncCursor.tenantId, set: { nextPageToken },
    });
  });
  await writeSyncState(tenantId, "inbox");
  publishRefresh(tenantId);
  return { cachedThreads: await countCachedThreads(tenantId), target: options.target ?? BACKGROUND_SYNC_TARGET };
}

export async function loadWorkspace(
  tenantId: string,
  query = "",
  options: { remote?: boolean; allowRemoteFallback?: boolean; limit?: number; offset?: number } = {},
): Promise<WorkspacePayload> {
  let threads: ThreadSummary[];
  let events: AgendaEvent[];
  let threadsPage = {
    offset: options.offset ?? 0,
    limit: options.limit ?? INITIAL_WORKSPACE_THREAD_PAGE_SIZE,
    total: 0,
    hasMore: false,
    nextOffset: null as number | null,
  };

  if (query) {
    if (options.remote) {
      // "Search all mail" — force a live Gmail query through Corsair.
      threads = await refreshInbox(tenantId, query);
    } else {
      // Lightning Search: instant local full-text first, Gmail only as fallback.
      threads = await searchThreadsLocal(tenantId, query);
      if (threads.length === 0 && options.allowRemoteFallback !== false) {
        try {
          threads = await withTimeout(
            refreshInbox(tenantId, query),
            DASHBOARD_REMOTE_FALLBACK_TIMEOUT_MS,
            "remote inbox search",
          );
        } catch (error) {
          log.warn("workspace_remote_fallback_failed", { tenantId, query, error });
        }
      }
    }
    events = await readCalendarEventsLocal(tenantId, query);
    threadsPage = {
      offset: 0,
      limit: threads.length,
      total: threads.length,
      hasMore: false,
      nextOffset: null,
    };
  } else {
    if ((options.offset ?? 0) > 0 && (options.offset ?? 0) >= await countCachedThreads(tenantId) && await isBackgroundInboxSyncing(tenantId)) {
      await expandInboxCache(tenantId);
    }
    const page = await readThreadSummariesPage(tenantId, {
      limit: options.limit ?? INITIAL_WORKSPACE_THREAD_PAGE_SIZE,
      offset: options.offset ?? 0,
    });
    threads = page.threads;
    threadsPage = {
      offset: page.offset,
      limit: page.limit,
      total: page.total,
      hasMore: page.hasMore,
      nextOffset: page.nextOffset,
    };
    events = await readCalendarEventsLocal(tenantId);
  }

  const [inboxSyncedAt, calendarSyncedAt, connection, cachedThreads, backgroundSyncing] = await Promise.all([
    readSyncState(tenantId, "inbox"),
    readSyncState(tenantId, "calendar"),
    getStoredConnectionStatus(tenantId),
    countCachedThreads(tenantId),
    query ? Promise.resolve(false) : isBackgroundInboxSyncing(tenantId),
  ]);

  if (!query && backgroundSyncing) {
    threadsPage.hasMore = true;
    threadsPage.nextOffset = threadsPage.offset + threads.length;
  }
  return {
    threads,
    activeThread: null,
    events,
    search: query,
    connection,
    threadsPage,
    cache: {
      cachedThreads,
      backgroundSyncTarget: BACKGROUND_SYNC_TARGET,
      backgroundSyncing,
    },
    syncedAt: {
      inbox: inboxSyncedAt,
      calendar: calendarSyncedAt,
    },
  };
}

export async function runThreadAction(
  tenantId: string,
  threadId: string,
  action: "archive" | "unarchive" | "star" | "unstar" | "read" | "unread" | "trash" | "untrash",
) {
  if (isDemoTenant(tenantId)) {
    const current = await getThreadDetail(tenantId, threadId);
    const next = applyDemoThreadAction(current, action);
    await writeThreadSummary(tenantId, next);
    await writeSyncState(tenantId, "inbox");
    return getThreadDetail(tenantId, threadId);
  }

  const tenant = await tenantClient(tenantId);

  if (action === "trash") {
    await tenant.gmail.api.threads.trash({ userId: "me", id: threadId });
  } else if (action === "untrash") {
    await tenant.gmail.api.threads.untrash({ userId: "me", id: threadId });
  } else {
    const changes =
      action === "archive"
        ? { removeLabelIds: ["INBOX"] }
        : action === "unarchive"
          ? { addLabelIds: ["INBOX"] }
          : action === "star"
            ? { addLabelIds: ["STARRED"] }
            : action === "unstar"
              ? { removeLabelIds: ["STARRED"] }
              : action === "read"
                ? { removeLabelIds: ["UNREAD"] }
                : { addLabelIds: ["UNREAD"] };

    await tenant.gmail.api.threads.modify({
      userId: "me",
      id: threadId,
      ...changes,
    });
  }

  return getThreadDetail(tenantId, threadId, { refresh: true });
}

export async function sendEmail(tenantId: string, profile: SessionUser, input: ComposeInput) {
  if (isDemoTenant(tenantId)) {
    const sentAt = new Date().toISOString();
    if (input.threadId) {
      const existing = await getThreadDetail(tenantId, input.threadId);
      const labels = uniqueLabels(removeLabel(removeLabel(existing.labels, "DRAFT"), "TRASH"));
      const appended: ThreadDetail = {
        ...existing,
        unread: false,
        archived: false,
        receivedAt: sentAt,
        messageCount: existing.messageCount + 1,
        snippet: input.body.slice(0, 140),
        bodyExcerpt: input.body.slice(0, 200),
        body: input.body,
        labels: labels.includes("INBOX") ? labels : addLabel(labels, "INBOX"),
        messages: [
          ...existing.messages.filter((message) => !message.labels.includes("DRAFT")),
          makeDemoMessage({
            id: `${existing.threadId}-message-${existing.messageCount + 1}`,
            from: `${profile.displayName} <${profile.email}>`,
            to: input.to,
            subject: input.subject,
            body: input.body,
            snippet: input.body.slice(0, 140),
            receivedAt: sentAt,
            labels: labels.includes("INBOX") ? labels : addLabel(labels, "INBOX"),
          }),
        ],
      };
      await writeThreadSummary(tenantId, appended);
      await writeSyncState(tenantId, "inbox");
      return appended;
    }

    const threadId = `demo-thread-sent-${Date.now()}`;
    const detail: ThreadDetail = {
      threadId,
      subject: input.subject,
      sender: profile.displayName,
      senderEmail: profile.email,
      recipients: input.to.split(",").map((value) => value.trim()).filter(Boolean),
      snippet: input.body.slice(0, 140),
      bodyExcerpt: input.body.slice(0, 200),
      receivedAt: sentAt,
      messageCount: 1,
      labels: ["SENT"],
      unread: false,
      starred: false,
      archived: false,
      priorityBand: "normal",
      priorityScore: 40,
      priorityReason: "Sent from the demo workspace.",
      body: input.body,
      htmlBody: `<p>${input.body.replace(/\n/g, "</p><p>")}</p>`,
      messages: [
        makeDemoMessage({
          id: `${threadId}-message-1`,
          from: `${profile.displayName} <${profile.email}>`,
          to: input.to,
          subject: input.subject,
          body: input.body,
          snippet: input.body.slice(0, 140),
          receivedAt: sentAt,
          labels: ["SENT"],
        }),
      ],
    };
    await writeThreadSummary(tenantId, detail);
    await writeSyncState(tenantId, "inbox");
    return detail;
  }

  const tenant = await tenantClient(tenantId);
  const raw = buildMimeMessage({
    from: `${profile.displayName} <${profile.email}>`,
    to: input.to.split(",").map((value) => value.trim()).filter(Boolean),
    cc: input.cc?.split(",").map((value) => value.trim()).filter(Boolean),
    bcc: input.bcc?.split(",").map((value) => value.trim()).filter(Boolean),
    subject: input.subject,
    body: input.body,
  });

  const sent: Awaited<ReturnType<typeof tenant.gmail.api.messages.send>> = await withTimeout(
    tenant.gmail.api.messages.send({
      userId: "me",
      raw,
      threadId: input.threadId,
    }),
    DASHBOARD_REMOTE_FALLBACK_TIMEOUT_MS,
    "gmail send",
  );

  if (sent.threadId) {
    return getThreadDetail(tenantId, sent.threadId, { refresh: true });
  }

  return null;
}

export async function saveDraft(tenantId: string, profile: SessionUser, input: ComposeInput) {
  if (isDemoTenant(tenantId)) {
    const draftedAt = new Date().toISOString();

    if (input.threadId) {
      const existing = await getThreadDetail(tenantId, input.threadId);
      const labels = uniqueLabels(addLabel(removeLabel(existing.labels, "TRASH"), "DRAFT"));
      const draftMessage = makeDemoMessage({
        id: `${existing.threadId}-draft-${Date.now()}`,
        from: `${profile.displayName} <${profile.email}>`,
        to: input.to,
        subject: input.subject,
        body: input.body,
        snippet: input.body.slice(0, 140),
        receivedAt: draftedAt,
        labels,
      });
      const persisted: ThreadDetail = {
        ...existing,
        snippet: input.body.slice(0, 140),
        bodyExcerpt: input.body.slice(0, 200),
        body: input.body,
        receivedAt: draftedAt,
        archived: true,
        unread: false,
        labels: removeLabel(labels, "INBOX"),
        messages: [
          ...existing.messages.filter((message) => !message.labels.includes("DRAFT")),
          draftMessage,
        ],
      };
      await writeThreadSummary(tenantId, persisted);
      await writeSyncState(tenantId, "inbox");
      return { id: draftMessage.id, message: { threadId: existing.threadId } };
    }

    const threadId = `demo-thread-draft-${Date.now()}`;
    const labels = ["DRAFT"];
    const detail: ThreadDetail = {
      threadId,
      subject: input.subject,
      sender: profile.displayName,
      senderEmail: profile.email,
      recipients: input.to.split(",").map((value) => value.trim()).filter(Boolean),
      snippet: input.body.slice(0, 140),
      bodyExcerpt: input.body.slice(0, 200),
      receivedAt: draftedAt,
      messageCount: 1,
      labels,
      unread: false,
      starred: false,
      archived: true,
      priorityBand: "low",
      priorityScore: 15,
      priorityReason: "Saved draft in the demo workspace.",
      body: input.body,
      htmlBody: `<p>${input.body.replace(/\n/g, "</p><p>")}</p>`,
      messages: [
        makeDemoMessage({
          id: `${threadId}-draft-1`,
          from: `${profile.displayName} <${profile.email}>`,
          to: input.to,
          subject: input.subject,
          body: input.body,
          snippet: input.body.slice(0, 140),
          receivedAt: draftedAt,
          labels,
        }),
      ],
    };
    await writeThreadSummary(tenantId, detail);
    await writeSyncState(tenantId, "inbox");
    return { id: `${threadId}-draft-1`, message: { threadId } };
  }

  const tenant = await tenantClient(tenantId);
  const raw = buildMimeMessage({
    from: `${profile.displayName} <${profile.email}>`,
    to: input.to.split(",").map((value) => value.trim()).filter(Boolean),
    cc: input.cc?.split(",").map((value) => value.trim()).filter(Boolean),
    bcc: input.bcc?.split(",").map((value) => value.trim()).filter(Boolean),
    subject: input.subject,
    body: input.body,
  });

  return tenant.gmail.api.drafts.create({
    userId: "me",
    draft: {
      message: {
        raw,
        threadId: input.threadId,
      },
    },
  });
}

function splitAttendees(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((email) => ({ email }));
}

export async function createEvent(tenantId: string, input: EventInput) {
  if (isDemoTenant(tenantId)) {
    const eventId = `demo-event-created-${Date.now()}`;
    const event: AgendaEvent = {
      id: eventId,
      summary: input.summary,
      description: input.description ?? "",
      location: input.location ?? "",
      start: input.start,
      end: input.end,
      attendees: splitAttendees(input.attendees).map((entry) => entry.email),
      status: "confirmed",
      htmlLink: demoCalendarLink(eventId),
    };
    await writeCalendarEvents(tenantId, [event]);
    await writeSyncState(tenantId, "calendar");
    return event;
  }

  const tenant = await tenantClient(tenantId);
  const event = await tenant.googlecalendar.api.events.create({
    calendarId: "primary",
    sendUpdates: "all",
    event: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: {
        dateTime: input.start,
      },
      end: {
        dateTime: input.end,
      },
      attendees: splitAttendees(input.attendees),
    },
  });

  return asAgendaEvent(event);
}

export async function updateEvent(tenantId: string, input: EventInput & { id: string }) {
  if (isDemoTenant(tenantId)) {
    const event: AgendaEvent = {
      id: input.id,
      summary: input.summary,
      description: input.description ?? "",
      location: input.location ?? "",
      start: input.start,
      end: input.end,
      attendees: splitAttendees(input.attendees).map((entry) => entry.email),
      status: "confirmed",
      htmlLink: demoCalendarLink(input.id),
    };
    await writeCalendarEvents(tenantId, [event]);
    await writeSyncState(tenantId, "calendar");
    return event;
  }

  const tenant = await tenantClient(tenantId);
  const event = await tenant.googlecalendar.api.events.update({
    calendarId: "primary",
    id: input.id,
    sendUpdates: "all",
    event: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: {
        dateTime: input.start,
      },
      end: {
        dateTime: input.end,
      },
      attendees: splitAttendees(input.attendees),
    },
  });

  return asAgendaEvent(event);
}

export async function runCommand(tenantId: string, profile: SessionUser, input: string): Promise<CommandResult> {
  const parsed = parseCommand(input);

  if (!parsed) {
    throw new Error("Command not understood. Try `search from:alice`, `email name@example.com about Roadmap :: Body`, or `schedule meeting with name@example.com tomorrow 9am :: Title`.");
  }

  if (parsed.kind === "search") {
    const payload = await loadWorkspace(tenantId, parsed.query);

    return {
      kind: "search",
      message: `Showing results for ${parsed.query}.`,
      payload,
    };
  }

  if (parsed.kind === "email") {
    const payload = await sendEmail(tenantId, profile, {
      to: parsed.to,
      subject: parsed.subject,
      body: parsed.body,
    });

    return {
      kind: "email",
      message: `Email sent to ${parsed.to}.`,
      payload,
    };
  }

  if (parsed.kind === "workflow") {
    const event = await createEvent(tenantId, {
      summary: parsed.summary,
      start: parsed.start,
      end: parsed.end,
      attendees: parsed.attendee,
    });

    const email = await sendEmail(tenantId, profile, {
      to: parsed.attendee,
      subject: parsed.emailSubject,
      body: parsed.emailBody,
    });

    return {
      kind: "workflow",
      message: `Meeting scheduled and follow-up email sent to ${parsed.attendee}.`,
      payload: {
        event,
        email,
      },
    };
  }

  const event = await createEvent(tenantId, {
    summary: parsed.summary,
    start: parsed.start,
    end: parsed.end,
    attendees: parsed.attendee,
  });

  return {
    kind: "event",
    message: `Meeting scheduled with ${parsed.attendee}.`,
    payload: event,
  };
}

export async function syncWorkspace(tenantId: string): Promise<WorkspacePayload> {
  await Promise.all([
    refreshInbox(tenantId),
    refreshInbox(tenantId, "label:SENT"),
    refreshCalendar(tenantId),
  ]);
  publishRefresh(tenantId);
  return loadWorkspace(tenantId);
}

/**
 * Build a stable dedupe key for an inbound webhook delivery, so Google/Pub-Sub
 * redeliveries don't trigger repeated syncs. Returns null when no reliable
 * identifier is available (caller then processes without dedupe).
 */
function webhookDedupeKey(
  plugin: string | null | undefined,
  headers: Record<string, string>,
  body: string,
): string | null {
  if (plugin === "gmail") {
    // Gmail arrives via a Pub/Sub push envelope: { message: { messageId, ... } }.
    const messageId = safeJsonParse<{ message?: { messageId?: string; message_id?: string } }>(body, {})
      ?.message;
    const id = messageId?.messageId ?? messageId?.message_id;
    return id ? `gmail:${id}` : null;
  }

  if (plugin === "googlecalendar") {
    // Calendar push notifications identify a delivery via channel headers.
    const channelId = headers["x-goog-channel-id"];
    const messageNumber = headers["x-goog-message-number"];
    if (channelId && messageNumber) {
      return `calendar:${channelId}:${messageNumber}`;
    }
    return null;
  }

  return null;
}

/**
 * Record a webhook delivery, returning true only the first time we see it.
 * Backed by `webhook_log` with an INSERT … ON CONFLICT DO NOTHING.
 */
async function recordWebhookOnce(tenantId: string, dedupeId: string): Promise<boolean> {
  const db = await drizzleDb();
  const id = createHash("sha256").update(`${tenantId}:${dedupeId}`).digest("hex");
  const rows = await db
    .insert(schema.webhookLog)
    .values({ id, tenantId })
    .onConflictDoNothing()
    .returning({ id: schema.webhookLog.id });

  // Best-effort prune of old entries to keep the table bounded.
  if (Math.random() < 0.02) {
    await db.delete(schema.webhookLog).where(sql`${schema.webhookLog.receivedAt} < NOW() - INTERVAL '7 days'`);
  }

  return rows.length > 0;
}

export async function handleWebhook(tenantId: string, headers: Record<string, string>, body: string) {
  const response = await processWebhook(await corsair(), headers, body, { tenantId });

  const dedupeId = webhookDedupeKey(response.plugin, headers, body);
  if (dedupeId) {
    const fresh = await recordWebhookOnce(tenantId, dedupeId);
    if (!fresh) {
      log.info("webhook_duplicate_skipped", { tenantId, plugin: response.plugin });
      return { ...response, duplicate: true };
    }
  }

  try {
    if (response.plugin === "gmail") {
      await refreshInbox(tenantId);
    }

    if (response.plugin === "googlecalendar") {
      await refreshCalendar(tenantId);
    }

    // Notify any connected browser for this tenant to reload live.
    publishRefresh(tenantId);
  } catch (error) {
    // Don't fail the webhook ack on a refresh hiccup — the cron/polling paths
    // will catch up — but make the failure visible in logs.
    log.error("webhook_refresh_failed", { tenantId, plugin: response.plugin, error });
  }

  return response;
}

export { isAuthError };
