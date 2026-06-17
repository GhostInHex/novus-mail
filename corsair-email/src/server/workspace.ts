import { createHash } from "node:crypto";

import { and, desc, eq, sql } from "drizzle-orm";
import { processWebhook } from "corsair";
import { AuthMissingError } from "corsair/core";
import { setupCorsair } from "corsair/setup";

import { parseCommand } from "@/lib/command-parser";
import { env } from "@/lib/env";
import { log } from "@/server/log";
import { normalizeThread } from "@/lib/gmail-normalize";
import { buildMimeMessage } from "@/lib/mime";
import { classifyPriority } from "@/lib/priority";
import type {
  AgendaEvent,
  CommandResult,
  ComposeInput,
  ConnectionStatus,
  EventInput,
  SessionUser,
  ThreadDetail,
  ThreadSummary,
  WorkspacePayload,
} from "@/lib/types";
import { safeJsonParse } from "@/lib/utils";
import { getAppDb, getCorsair, getDrizzleDb } from "@/server/corsair-client";
import { schema } from "@/server/db";
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

const GMAIL_PAGE_SIZE = 50;
const GMAIL_SYNC_THREAD_LIMIT = 500;
const GMAIL_SEARCH_THREAD_LIMIT = 100;
const GMAIL_DETAIL_CONCURRENCY = 8;
const CALENDAR_PAGE_SIZE = 100;
const CALENDAR_SYNC_EVENT_LIMIT = 500;

function now() {
  return new Date();
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

    if (env.GMAIL_TOPIC_ID && client.keys.gmail.get_topic_id && client.keys.gmail.set_topic_id) {
      const existingTopicId = await client.keys.gmail.get_topic_id();
      if (!existingTopicId) {
        await client.keys.gmail.set_topic_id(env.GMAIL_TOPIC_ID);
      }
    }

    return seeded.some(Boolean);
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

async function writeThreadSummary(tenantId: string, detail: ThreadDetail) {
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
      target: [schema.emailThreadCache.tenantId, schema.emailThreadCache.threadId],
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

async function readThreadSummaries(tenantId: string) {
  const db = await drizzleDb();
  const rows = await db.query.emailThreadCache.findMany({
    where: eq(schema.emailThreadCache.tenantId, tenantId),
    orderBy: [desc(schema.emailThreadCache.priorityScore), desc(schema.emailThreadCache.receivedAt)],
  });

  return rows.map(mapThreadRow);
}

async function readThreadDetailFromCache(tenantId: string, threadId: string) {
  const db = await drizzleDb();
  const row = await db.query.emailThreadCache.findFirst({
    where: and(eq(schema.emailThreadCache.tenantId, tenantId), eq(schema.emailThreadCache.threadId, threadId)),
  });

  if (!row) {
    return null;
  }

  return mapThreadDetailRow(row);
}

async function repairThreadBodies(tenantId: string, threads: ThreadSummary[]) {
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

async function writeCalendarEvents(tenantId: string, events: AgendaEvent[]) {
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
        target: [schema.calendarEventCache.tenantId, schema.calendarEventCache.eventId],
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
  const db = await appDb();
  const trimmed = query.trim();

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
}

async function writeSyncState(tenantId: string, resource: SyncResource) {
  const db = await drizzleDb();
  const syncedAt = now();

  await db
    .insert(schema.syncState)
    .values({ tenantId, resource, syncedAt })
    .onConflictDoUpdate({
      target: [schema.syncState.tenantId, schema.syncState.resource],
      set: { syncedAt },
    });
}

async function readSyncState(tenantId: string, resource: SyncResource) {
  const db = await drizzleDb();
  const row = await db.query.syncState.findFirst({
    where: and(eq(schema.syncState.tenantId, tenantId), eq(schema.syncState.resource, resource)),
  });

  return toIsoString(row?.syncedAt);
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

export async function ensureTenant(session: SessionUser) {
  await upsertProfile(session);

  const client = await corsair();
  const setupLog = await setupCorsair(client, {
    tenantId: session.tenantId,
  });
  const seededCredentials = await ensureIntegrationCredentials();

  return seededCredentials
    ? setupCorsair(client, {
        tenantId: session.tenantId,
      })
    : setupLog;
}

export async function getConnectionStatus(tenantId: string, setupLog: string): Promise<ConnectionStatus> {
  const tenant = await tenantClient(tenantId);
  const [gmailCheck, calendarCheck] = await Promise.allSettled([
    tenant.gmail.api.labels.list({ userId: "me" }),
    tenant.googlecalendar.api.events.getMany({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      maxResults: 1,
      singleEvents: true,
      orderBy: "startTime",
    }),
  ]);

  const gmail = gmailCheck.status === "fulfilled";
  const calendar = calendarCheck.status === "fulfilled";

  return {
    gmail,
    calendar,
    ready: gmail && calendar,
    setupLog,
  };
}

async function fetchGmailThreadIds(
  tenant: Awaited<ReturnType<typeof tenantClient>>,
  query: string,
  limit: number,
) {
  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const response = await tenant.gmail.api.threads.list({
      userId: "me",
      q: query || undefined,
      maxResults: Math.min(GMAIL_PAGE_SIZE, limit - ids.length),
      pageToken,
      includeSpamTrash: false,
    });

    for (const thread of response.threads ?? []) {
      if (thread.id) {
        ids.push(thread.id);
      }
    }

    pageToken = response.nextPageToken;
  } while (pageToken && ids.length < limit);

  return ids;
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
  options: { limit?: number } = {},
) {
  const tenant = await tenantClient(tenantId);
  const limit = options.limit ?? (query ? GMAIL_SEARCH_THREAD_LIMIT : GMAIL_SYNC_THREAD_LIMIT);
  const threadIds = await fetchGmailThreadIds(tenant, query, limit);

  const details = await mapConcurrent(threadIds, GMAIL_DETAIL_CONCURRENCY, async (id) => {
    const fullThread = await tenant.gmail.api.threads.get({
      userId: "me",
      id,
      format: "full",
      metadataHeaders: ["From", "To", "Subject", "Date"],
    });

    return writeThreadSummary(tenantId, normalizeThread(fullThread));
  });

  await writeSyncState(tenantId, "inbox");

  return details.sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }

    return (right.receivedAt ?? "").localeCompare(left.receivedAt ?? "");
  });
}

export async function refreshCalendar(tenantId: string) {
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

export async function loadWorkspace(
  tenantId: string,
  query = "",
  options: { remote?: boolean } = {},
): Promise<WorkspacePayload> {
  let threads: ThreadSummary[];
  let events: AgendaEvent[];

  if (query) {
    if (options.remote) {
      // "Search all mail" — force a live Gmail query through Corsair.
      threads = await refreshInbox(tenantId, query);
    } else {
      // Lightning Search: instant local full-text first, Gmail only as fallback.
      threads = await searchThreadsLocal(tenantId, query);
      if (threads.length === 0) {
        threads = await refreshInbox(tenantId, query);
      }
    }
    events = await readCalendarEventsLocal(tenantId, query);
  } else {
    threads = await readThreadSummaries(tenantId);
    if (threads.length === 0) {
      threads = await refreshInbox(tenantId);
    }
    events = await readCalendarEventsLocal(tenantId);
    if (events.length === 0) {
      events = await refreshCalendar(tenantId);
    }
  }

  const activeThread = threads[0] ? await getThreadDetail(tenantId, threads[0].threadId) : null;
  await repairThreadBodies(tenantId, threads);
  const [inboxSyncedAt, calendarSyncedAt] = await Promise.all([
    readSyncState(tenantId, "inbox"),
    readSyncState(tenantId, "calendar"),
  ]);

  return {
    threads,
    activeThread,
    events,
    search: query,
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
  const tenant = await tenantClient(tenantId);
  const raw = buildMimeMessage({
    from: `${profile.displayName} <${profile.email}>`,
    to: input.to.split(",").map((value) => value.trim()).filter(Boolean),
    cc: input.cc?.split(",").map((value) => value.trim()).filter(Boolean),
    bcc: input.bcc?.split(",").map((value) => value.trim()).filter(Boolean),
    subject: input.subject,
    body: input.body,
  });

  const sent = await tenant.gmail.api.messages.send({
    userId: "me",
    raw,
    threadId: input.threadId,
  });

  if (sent.threadId) {
    return getThreadDetail(tenantId, sent.threadId, { refresh: true });
  }

  return null;
}

export async function saveDraft(tenantId: string, profile: SessionUser, input: ComposeInput) {
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
  await Promise.all([refreshInbox(tenantId), refreshCalendar(tenantId)]);
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
