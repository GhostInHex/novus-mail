import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const corsairIntegrations = pgTable("corsair_integrations", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  name: text("name").notNull().unique(),
  config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
  dek: text("dek"),
});

export const corsairAccounts = pgTable(
  "corsair_accounts",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    tenantId: text("tenant_id").notNull(),
    integrationId: text("integration_id")
      .notNull()
      .references(() => corsairIntegrations.id, { onDelete: "cascade" }),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    dek: text("dek"),
  },
  (table) => [unique("corsair_accounts_tenant_integration_unique").on(table.tenantId, table.integrationId)],
);

export const corsairEntities = pgTable(
  "corsair_entities",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    accountId: text("account_id")
      .notNull()
      .references(() => corsairAccounts.id, { onDelete: "cascade" }),
    entityId: text("entity_id").notNull(),
    entityType: text("entity_type").notNull(),
    version: text("version").notNull(),
    data: jsonb("data").notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [
    unique("corsair_entities_account_entity_unique").on(table.accountId, table.entityType, table.entityId),
    index("corsair_entities_scope_idx").on(table.accountId, table.entityType, table.entityId),
  ],
);

export const corsairEvents = pgTable(
  "corsair_events",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    accountId: text("account_id")
      .notNull()
      .references(() => corsairAccounts.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    status: text("status"),
  },
  (table) => [index("corsair_events_account_status_idx").on(table.accountId, table.status)],
);

export const corsairPermissions = pgTable(
  "corsair_permissions",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    token: text("token").notNull().unique(),
    plugin: text("plugin").notNull(),
    endpoint: text("endpoint").notNull(),
    args: text("args").notNull(),
    tenantId: text("tenant_id").notNull().default("default"),
    status: text("status").notNull().default("pending"),
    expiresAt: text("expires_at").notNull(),
    error: text("error"),
  },
  (table) => [index("corsair_permissions_lookup_idx").on(table.plugin, table.endpoint, table.tenantId, table.status, table.expiresAt)],
);

export const appProfiles = pgTable("app_profiles", {
  tenantId: text("tenant_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
}, (table) => [index("app_profiles_email_idx").on(table.email)]);

export const emailThreadCache = pgTable(
  "email_thread_cache",
  {
    tenantId: text("tenant_id").notNull(),
    threadId: text("thread_id").notNull(),
    subject: text("subject"),
    sender: text("sender"),
    senderEmail: text("sender_email"),
    recipients: text("recipients").notNull().default("[]"),
    snippet: text("snippet"),
    bodyExcerpt: text("body_excerpt"),
    bodyText: text("body_text").notNull().default(""),
    htmlBody: text("html_body"),
    messagesJson: jsonb("messages_json").notNull().default(sql`'[]'::jsonb`),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    messageCount: integer("message_count").notNull().default(0),
    labelsJson: text("labels_json").notNull().default("[]"),
    unread: boolean("unread").notNull().default(false),
    starred: boolean("starred").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    priorityBand: text("priority_band").notNull().default("normal"),
    priorityScore: integer("priority_score").notNull().default(0),
    priorityReason: text("priority_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.threadId] }),
    index("email_thread_cache_tenant_priority_received_idx").on(table.tenantId, table.priorityScore, table.receivedAt),
  ],
);

export const calendarEventCache = pgTable(
  "calendar_event_cache",
  {
    tenantId: text("tenant_id").notNull(),
    eventId: text("event_id").notNull(),
    summary: text("summary").notNull().default(""),
    description: text("description").notNull().default(""),
    location: text("location").notNull().default(""),
    startAt: timestamp("start_at", { withTimezone: true }),
    endAt: timestamp("end_at", { withTimezone: true }),
    startValue: text("start_value"),
    endValue: text("end_value"),
    attendeesJson: text("attendees_json").notNull().default("[]"),
    status: text("status").notNull().default("confirmed"),
    htmlLink: text("html_link"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.eventId] }),
    index("calendar_event_cache_tenant_start_idx").on(table.tenantId, table.startAt),
  ],
);

export const syncState = pgTable(
  "sync_state",
  {
    tenantId: text("tenant_id").notNull(),
    resource: text("resource").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.resource] })],
);

export const rateLimit = pgTable(
  "rate_limit",
  {
    bucketKey: text("bucket_key").notNull(),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.bucketKey, table.windowStart] }),
    index("rate_limit_window_idx").on(table.windowStart),
  ],
);

export const webhookLog = pgTable(
  "webhook_log",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("webhook_log_received_idx").on(table.receivedAt)],
);

export const watchState = pgTable(
  "watch_state",
  {
    tenantId: text("tenant_id").notNull(),
    resource: text("resource").notNull(),
    channelId: text("channel_id"),
    resourceId: text("resource_id"),
    historyId: text("history_id"),
    expiration: bigint("expiration", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.resource] }),
    index("watch_state_channel_id_idx").on(table.channelId),
  ],
);
