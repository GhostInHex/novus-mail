CREATE INDEX IF NOT EXISTS app_profiles_email_idx
  ON app_profiles USING btree (email);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS watch_state_channel_id_idx
  ON watch_state USING btree (channel_id);
