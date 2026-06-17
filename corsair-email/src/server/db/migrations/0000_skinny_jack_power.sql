CREATE TABLE "app_profiles" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_event_cache" (
	"tenant_id" text NOT NULL,
	"event_id" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"start_value" text,
	"end_value" text,
	"attendees_json" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"html_link" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "calendar_event_cache_tenant_id_event_id_pk" PRIMARY KEY("tenant_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "corsair_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tenant_id" text NOT NULL,
	"integration_id" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dek" text,
	CONSTRAINT "corsair_accounts_tenant_integration_unique" UNIQUE("tenant_id","integration_id")
);
--> statement-breakpoint
CREATE TABLE "corsair_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"version" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "corsair_entities_account_entity_unique" UNIQUE("account_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "corsair_events" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"account_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text
);
--> statement-breakpoint
CREATE TABLE "corsair_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dek" text,
	CONSTRAINT "corsair_integrations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "corsair_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token" text NOT NULL,
	"plugin" text NOT NULL,
	"endpoint" text NOT NULL,
	"args" text NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" text NOT NULL,
	"error" text,
	CONSTRAINT "corsair_permissions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "email_thread_cache" (
	"tenant_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"subject" text,
	"sender" text,
	"sender_email" text,
	"recipients" text DEFAULT '[]' NOT NULL,
	"snippet" text,
	"body_excerpt" text,
	"body_text" text DEFAULT '' NOT NULL,
	"html_body" text,
	"messages_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"received_at" timestamp with time zone,
	"message_count" integer DEFAULT 0 NOT NULL,
	"labels_json" text DEFAULT '[]' NOT NULL,
	"unread" boolean DEFAULT false NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"priority_band" text DEFAULT 'normal' NOT NULL,
	"priority_score" integer DEFAULT 0 NOT NULL,
	"priority_reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "email_thread_cache_tenant_id_thread_id_pk" PRIMARY KEY("tenant_id","thread_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"bucket_key" text NOT NULL,
	"window_start" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_bucket_key_window_start_pk" PRIMARY KEY("bucket_key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"tenant_id" text NOT NULL,
	"resource" text NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sync_state_tenant_id_resource_pk" PRIMARY KEY("tenant_id","resource")
);
--> statement-breakpoint
CREATE TABLE "watch_state" (
	"tenant_id" text NOT NULL,
	"resource" text NOT NULL,
	"channel_id" text,
	"resource_id" text,
	"history_id" text,
	"expiration" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_state_tenant_id_resource_pk" PRIMARY KEY("tenant_id","resource")
);
--> statement-breakpoint
CREATE TABLE "webhook_log" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "corsair_accounts" ADD CONSTRAINT "corsair_accounts_integration_id_corsair_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."corsair_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corsair_entities" ADD CONSTRAINT "corsair_entities_account_id_corsair_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."corsair_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corsair_events" ADD CONSTRAINT "corsair_events_account_id_corsair_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."corsair_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_event_cache_tenant_start_idx" ON "calendar_event_cache" USING btree ("tenant_id","start_at");--> statement-breakpoint
CREATE INDEX "corsair_entities_scope_idx" ON "corsair_entities" USING btree ("account_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "corsair_events_account_status_idx" ON "corsair_events" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "corsair_permissions_lookup_idx" ON "corsair_permissions" USING btree ("plugin","endpoint","tenant_id","status","expires_at");--> statement-breakpoint
CREATE INDEX "email_thread_cache_tenant_priority_received_idx" ON "email_thread_cache" USING btree ("tenant_id","priority_score","received_at");--> statement-breakpoint
CREATE INDEX "rate_limit_window_idx" ON "rate_limit" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "webhook_log_received_idx" ON "webhook_log" USING btree ("received_at");