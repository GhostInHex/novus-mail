import crypto from "node:crypto";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { log } from "@/server/log";
import { clientIp, enforceRateLimit } from "@/server/rate-limit";
import { handleWebhook } from "@/server/workspace";
import { getDrizzleDb } from "@/server/corsair-client";
import { schema } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function normalizeHeaderMap(headers: Headers) {
  return Object.fromEntries(headers.entries());
}

function parseGmailEmailAddress(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { message?: { data?: string } };
    const data = parsed.message?.data;
    if (!data) {
      return null;
    }

    const decoded = Buffer.from(data, "base64url").toString("utf8");
    const envelope = JSON.parse(decoded) as { emailAddress?: string };
    return typeof envelope.emailAddress === "string" && envelope.emailAddress.trim() ? envelope.emailAddress.trim() : null;
  } catch {
    return null;
  }
}

async function resolveTenantId(
  request: Request,
  rawBody: string,
  fallbackTenantId: string | null,
): Promise<string | null> {
  if (fallbackTenantId) {
    return fallbackTenantId;
  }

  const headers = normalizeHeaderMap(request.headers);
  const channelId = headers["x-goog-channel-id"];
  if (channelId) {
    const db = await getDrizzleDb();
    const watch = await db.query.watchState.findFirst({
      where: eq(schema.watchState.channelId, channelId),
    });
    return watch?.tenantId ?? null;
  }

  const emailAddress = parseGmailEmailAddress(rawBody);
  if (emailAddress) {
    const db = await getDrizzleDb();
    const profile = await db.query.appProfiles.findFirst({
      where: eq(schema.appProfiles.email, emailAddress),
    });
    return profile?.tenantId ?? null;
  }

  return null;
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const token = searchParams.get("token");
  const channelToken = request.headers.get("x-goog-channel-token");

  const rawBody = await request.text();
  const resolvedTenantId = await resolveTenantId(request, rawBody, tenantId);
  if (!resolvedTenantId) {
    log.warn("webhook_tenant_unresolved", { ip: clientIp(request) });
    return NextResponse.json({ success: true });
  }

  // Shared-secret gate. The registered webhook URL carries `&token=<WEBHOOK_SECRET>`;
  // Calendar push also echoes it as the channel token. Reject anything else.
  if (env.WEBHOOK_SECRET) {
    const provided = token ?? channelToken ?? "";
    if (!timingSafeEqual(provided, env.WEBHOOK_SECRET)) {
      log.warn("webhook_unauthorized", { tenantId: resolvedTenantId, ip: clientIp(request) });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    log.warn("webhook_unauthenticated_accepted", { tenantId: resolvedTenantId });
  }

  // Generous per-tenant cap to blunt a notification flood without dropping
  // legitimate bursts.
  const limited = await enforceRateLimit({
    identity: resolvedTenantId,
    route: "webhook",
    limit: 240,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  try {
    const payload = await handleWebhook(resolvedTenantId, normalizeHeaderMap(request.headers), rawBody);
    return NextResponse.json(payload.response ?? { success: true });
  } catch (error) {
    // Ack with 200 so Google/Pub-Sub don't enter a retry storm; the error is
    // logged and the cron/polling paths reconcile later.
    log.error("webhook_failed", { tenantId: resolvedTenantId, error });
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
