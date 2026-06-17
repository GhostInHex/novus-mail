import type { Sql } from "postgres";

export type AppDatabase = Sql;

const STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS corsair_integrations (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      name TEXT NOT NULL UNIQUE,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      dek TEXT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS corsair_accounts (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tenant_id TEXT NOT NULL,
      integration_id TEXT NOT NULL REFERENCES corsair_integrations(id) ON DELETE CASCADE,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      dek TEXT NULL,
      CONSTRAINT corsair_accounts_tenant_integration_unique UNIQUE (tenant_id, integration_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS corsair_entities (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      account_id TEXT NOT NULL REFERENCES corsair_accounts(id) ON DELETE CASCADE,
      entity_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      version TEXT NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT corsair_entities_account_entity_unique UNIQUE (account_id, entity_type, entity_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS corsair_events (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      account_id TEXT NOT NULL REFERENCES corsair_accounts(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS corsair_permissions (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      token TEXT NOT NULL UNIQUE,
      plugin TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      args TEXT NOT NULL,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'executing', 'completed', 'denied', 'expired', 'failed')
      ),
      expires_at TEXT NOT NULL,
      error TEXT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS app_profiles (
      tenant_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS email_thread_cache (
      tenant_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      subject TEXT,
      sender TEXT,
      sender_email TEXT,
      recipients TEXT NOT NULL DEFAULT '[]',
      snippet TEXT,
      body_excerpt TEXT,
      body_text TEXT NOT NULL DEFAULT '',
      html_body TEXT NULL,
      messages_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      received_at TIMESTAMPTZ NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      labels_json TEXT NOT NULL DEFAULT '[]',
      unread BOOLEAN NOT NULL DEFAULT FALSE,
      starred BOOLEAN NOT NULL DEFAULT FALSE,
      archived BOOLEAN NOT NULL DEFAULT FALSE,
      priority_band TEXT NOT NULL DEFAULT 'normal',
      priority_score INTEGER NOT NULL DEFAULT 0,
      priority_reason TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (tenant_id, thread_id)
    )
  `,
  `
    ALTER TABLE email_thread_cache
      ADD COLUMN IF NOT EXISTS body_text TEXT NOT NULL DEFAULT ''
  `,
  `
    ALTER TABLE email_thread_cache
      ADD COLUMN IF NOT EXISTS html_body TEXT NULL
  `,
  `
    ALTER TABLE email_thread_cache
      ADD COLUMN IF NOT EXISTS messages_json JSONB NOT NULL DEFAULT '[]'::jsonb
  `,
  `
    CREATE TABLE IF NOT EXISTS calendar_event_cache (
      tenant_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      start_at TIMESTAMPTZ NULL,
      end_at TIMESTAMPTZ NULL,
      start_value TEXT NULL,
      end_value TEXT NULL,
      attendees_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'confirmed',
      html_link TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      search_tsv tsvector GENERATED ALWAYS AS (
        to_tsvector(
          'english',
          coalesce(summary, '') || ' ' ||
          coalesce(description, '') || ' ' ||
          coalesce(location, '') || ' ' ||
          coalesce(attendees_json, '')
        )
      ) STORED,
      PRIMARY KEY (tenant_id, event_id)
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS sync_state (
      tenant_id TEXT NOT NULL,
      resource TEXT NOT NULL,
      synced_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (tenant_id, resource)
    )
  `,
  // Fixed-window rate limiting. Keyed by (bucket, window-start-ms) so the count
  // resets each window. Postgres-backed so limits hold across serverless
  // instances without any extra infrastructure (no Redis).
  `
    CREATE TABLE IF NOT EXISTS rate_limit (
      bucket_key TEXT NOT NULL,
      window_start BIGINT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (bucket_key, window_start)
    )
  `,
  // Idempotency log for inbound webhooks — dedupes Google/Pub-Sub redeliveries
  // so a single notification doesn't trigger repeated syncs.
  `
    CREATE TABLE IF NOT EXISTS webhook_log (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  // Push-notification watch lifecycle (Gmail Pub/Sub + Calendar channels), so
  // the cron renewal job knows what to refresh before the ~7-day expiry.
  `
    CREATE TABLE IF NOT EXISTS watch_state (
      tenant_id TEXT NOT NULL,
      resource TEXT NOT NULL,
      channel_id TEXT NULL,
      resource_id TEXT NULL,
      history_id TEXT NULL,
      expiration BIGINT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tenant_id, resource)
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS corsair_entities_scope_idx
      ON corsair_entities (account_id, entity_type, entity_id)
  `,
  `
    CREATE INDEX IF NOT EXISTS corsair_events_account_status_idx
      ON corsair_events (account_id, status)
  `,
  `
    CREATE INDEX IF NOT EXISTS corsair_permissions_lookup_idx
      ON corsair_permissions (plugin, endpoint, tenant_id, status, expires_at)
  `,
  `
    CREATE INDEX IF NOT EXISTS email_thread_cache_tenant_priority_received_idx
      ON email_thread_cache (tenant_id, priority_score DESC, received_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS calendar_event_cache_tenant_start_idx
      ON calendar_event_cache (tenant_id, start_at)
  `,
  // Lightning Search: a generated full-text vector over the cached thread fields,
  // plus a GIN index. Enables sub-second local search without a Gmail round-trip.
  `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        JOIN pg_class class ON class.oid = attribute.attrelid
        JOIN pg_attrdef definition
          ON definition.adrelid = attribute.attrelid
          AND definition.adnum = attribute.attnum
        WHERE class.relname = 'email_thread_cache'
          AND attribute.attname = 'search_tsv'
          AND pg_get_expr(definition.adbin, definition.adrelid) NOT ILIKE '%body_text%'
      ) THEN
        EXECUTE 'DROP INDEX IF EXISTS email_thread_cache_search_tsv_idx';
        EXECUTE 'ALTER TABLE email_thread_cache DROP COLUMN search_tsv';
      END IF;
    END $$;
  `,
  `
    ALTER TABLE email_thread_cache
      ADD COLUMN IF NOT EXISTS search_tsv tsvector
      GENERATED ALWAYS AS (
        to_tsvector(
          'english',
          coalesce(subject, '') || ' ' ||
          coalesce(sender, '') || ' ' ||
          coalesce(sender_email, '') || ' ' ||
          coalesce(snippet, '') || ' ' ||
          coalesce(body_excerpt, '') || ' ' ||
          coalesce(body_text, '') || ' ' ||
          coalesce(recipients, '')
        )
      ) STORED
  `,
  `
    CREATE INDEX IF NOT EXISTS email_thread_cache_search_tsv_idx
      ON email_thread_cache USING GIN (search_tsv)
  `,
  `
    CREATE INDEX IF NOT EXISTS calendar_event_cache_search_tsv_idx
      ON calendar_event_cache USING GIN (search_tsv)
  `,
  `
    CREATE INDEX IF NOT EXISTS rate_limit_window_idx
      ON rate_limit (window_start)
  `,
  `
    CREATE INDEX IF NOT EXISTS webhook_log_received_idx
      ON webhook_log (received_at)
  `,
];

export async function ensureDatabaseTables(sql: AppDatabase) {
  for (const statement of STATEMENTS) {
    await sql.unsafe(statement);
  }
}
