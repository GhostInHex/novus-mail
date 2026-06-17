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
--> statement-breakpoint
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
  ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS email_thread_cache_search_tsv_idx
  ON email_thread_cache USING GIN (search_tsv);
--> statement-breakpoint
ALTER TABLE calendar_event_cache
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(summary, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(location, '') || ' ' ||
      coalesce(attendees_json, '')
    )
  ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS calendar_event_cache_search_tsv_idx
  ON calendar_event_cache USING GIN (search_tsv);
