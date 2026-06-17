import { randomUUID } from "node:crypto";

import { createAccountKeyManager } from "corsair/core";
import { createCorsairDatabase } from "corsair/db";

import { env } from "@/lib/env";
import { getAppDb, getDrizzleDb } from "@/server/corsair-client";
import { schema } from "@/server/db";
import { log } from "@/server/log";

/**
 * Push-notification watch renewal.
 *
 * Gmail Pub/Sub watches and Calendar push channels expire (~7 days), so live
 * updates die unless re-registered. This mirrors what `corsair watch-renew`
 * does under the hood — read the tenant's stored Google credentials, refresh an
 * access token, and call Google's watch endpoints — but runs in-app so a Vercel
 * Cron can keep every tenant's watches alive automatically.
 */

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1";
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

type RenewOutcome =
  | { tenantId: string; resource: "gmail" | "calendar"; status: "renewed"; expiration: number | null }
  | { tenantId: string; resource: "gmail" | "calendar"; status: "skipped"; reason: string }
  | { tenantId: string; resource: "gmail" | "calendar"; status: "error"; reason: string };

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`token refresh failed (${response.status})`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("token refresh returned no access_token");
  }
  return data.access_token;
}

async function tenantCredentials(integrationName: "gmail" | "googlecalendar", tenantId: string) {
  // The key manager expects a CorsairDatabase wrapper, not the raw postgres Sql.
  const database = createCorsairDatabase(await getAppDb());
  const accountKm = createAccountKeyManager({
    authType: "oauth_2",
    integrationName,
    tenantId,
    kek: env.CORSAIR_KEK,
    database,
  });

  const { client_id, client_secret } = await accountKm.get_integration_credentials();
  const refresh_token = await accountKm.get_refresh_token();

  return { clientId: client_id, clientSecret: client_secret, refreshToken: refresh_token };
}

async function upsertWatchState(
  tenantId: string,
  resource: "gmail" | "calendar",
  fields: { channelId?: string | null; resourceId?: string | null; historyId?: string | null; expiration?: number | null },
) {
  const db = await getDrizzleDb();
  const updatedAt = new Date();
  const values = {
    tenantId,
    resource,
    channelId: fields.channelId ?? null,
    resourceId: fields.resourceId ?? null,
    historyId: fields.historyId ?? null,
    expiration: fields.expiration ?? null,
    updatedAt,
  };

  await db
    .insert(schema.watchState)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.watchState.tenantId, schema.watchState.resource],
      set: {
        channelId: values.channelId,
        resourceId: values.resourceId,
        historyId: values.historyId,
        expiration: values.expiration,
        updatedAt,
      },
    });
}

function webhookUrl(tenantId: string): string {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const params = new URLSearchParams();
  if (env.WEBHOOK_SECRET) {
    params.set("token", env.WEBHOOK_SECRET);
  }
  params.set("tenantId", tenantId);
  return `${base}/api/webhooks?${params.toString()}`;
}

export async function renewGmailWatch(tenantId: string): Promise<RenewOutcome> {
  if (!env.GMAIL_TOPIC_ID) {
    return { tenantId, resource: "gmail", status: "skipped", reason: "GMAIL_TOPIC_ID unset" };
  }

  try {
    const { clientId, clientSecret, refreshToken } = await tenantCredentials("gmail", tenantId);
    if (!clientId || !clientSecret || !refreshToken) {
      return { tenantId, resource: "gmail", status: "skipped", reason: "tenant not authorized" };
    }

    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    const response = await fetch(`${GMAIL_API_BASE}/users/me/watch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ topicName: env.GMAIL_TOPIC_ID, labelIds: ["INBOX"] }),
    });

    if (!response.ok) {
      throw new Error(`gmail watch failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
    }

    const data = (await response.json()) as { historyId?: string; expiration?: string };
    const expiration = data.expiration ? Number(data.expiration) : null;
    await upsertWatchState(tenantId, "gmail", { historyId: data.historyId ?? null, expiration });

    return { tenantId, resource: "gmail", status: "renewed", expiration };
  } catch (error) {
    return { tenantId, resource: "gmail", status: "error", reason: error instanceof Error ? error.message : "unknown" };
  }
}

export async function renewCalendarWatch(tenantId: string): Promise<RenewOutcome> {
  try {
    const { clientId, clientSecret, refreshToken } = await tenantCredentials("googlecalendar", tenantId);
    if (!clientId || !clientSecret || !refreshToken) {
      return { tenantId, resource: "calendar", status: "skipped", reason: "tenant not authorized" };
    }

    const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);
    const channelId = randomUUID();
    const response = await fetch(`${CALENDAR_API_BASE}/calendars/primary/events/watch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl(tenantId),
        // Echoed back as X-Goog-Channel-Token so the webhook route can verify it.
        ...(env.WEBHOOK_SECRET ? { token: env.WEBHOOK_SECRET } : {}),
      }),
    });

    if (!response.ok) {
      throw new Error(`calendar watch failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
    }

    const data = (await response.json()) as { resourceId?: string; expiration?: string };
    const expiration = data.expiration ? Number(data.expiration) : null;
    await upsertWatchState(tenantId, "calendar", {
      channelId,
      resourceId: data.resourceId ?? null,
      expiration,
    });

    return { tenantId, resource: "calendar", status: "renewed", expiration };
  } catch (error) {
    return { tenantId, resource: "calendar", status: "error", reason: error instanceof Error ? error.message : "unknown" };
  }
}

/** Renew Gmail + Calendar watches for every known tenant. Never throws. */
export async function renewAllWatches(): Promise<{ outcomes: RenewOutcome[]; renewed: number; skipped: number; errors: number }> {
  const db = await getDrizzleDb();
  const tenants = await db.select({ tenantId: schema.appProfiles.tenantId }).from(schema.appProfiles);

  const outcomes: RenewOutcome[] = [];
  for (const { tenantId } of tenants) {
    outcomes.push(await renewGmailWatch(tenantId));
    outcomes.push(await renewCalendarWatch(tenantId));
  }

  const renewed = outcomes.filter((outcome) => outcome.status === "renewed").length;
  const skipped = outcomes.filter((outcome) => outcome.status === "skipped").length;
  const errors = outcomes.filter((outcome) => outcome.status === "error").length;

  log.info("watch_renewal_run", { tenants: tenants.length, renewed, skipped, errors });

  return { outcomes, renewed, skipped, errors };
}
