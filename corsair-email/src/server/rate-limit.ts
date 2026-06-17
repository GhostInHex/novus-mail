import { NextResponse } from "next/server";
import { lt, sql } from "drizzle-orm";

import { getDrizzleDb } from "@/server/corsair-client";
import { schema } from "@/server/db";
import { log } from "@/server/log";

/**
 * Postgres-backed fixed-window rate limiting.
 *
 * Each (bucket, window) row is incremented atomically with an upsert, so the
 * limit holds across all serverless instances with no extra infrastructure
 * (no Redis). Windows are aligned to wall-clock so counts reset predictably.
 */

export type RateLimitResult = {
  ok: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
};

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;

  try {
    const db = await getDrizzleDb();
    const rows = await db
      .insert(schema.rateLimit)
      .values({ bucketKey: key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [schema.rateLimit.bucketKey, schema.rateLimit.windowStart],
        set: { count: sql`${schema.rateLimit.count} + 1` },
      })
      .returning({ count: schema.rateLimit.count });

    // Opportunistically prune long-expired windows (~2% of calls) so the table
    // stays small without a dedicated job.
    if (Math.random() < 0.02) {
      await db.delete(schema.rateLimit).where(lt(schema.rateLimit.windowStart, windowStart - windowMs));
    }

    const count = Number(rows[0]?.count ?? 1);
    const ok = count <= limit;
    const retryAfterSeconds = ok ? 0 : Math.max(1, Math.ceil((windowStart + windowMs - Date.now()) / 1000));

    return { ok, count, limit, retryAfterSeconds };
  } catch (error) {
    // Fail open: a rate-limiter outage must not take down the whole app.
    log.error("rate_limit_check_failed", { key, error });
    return { ok: true, count: 0, limit, retryAfterSeconds: 0 };
  }
}

/** Best-effort client IP from the standard proxy headers (Vercel sets these). */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

type EnforceOptions = {
  /** Stable identifier for the caller, e.g. a tenantId or client IP. */
  identity: string;
  /** Route label, used to namespace the bucket. */
  route: string;
  limit: number;
  windowMs: number;
};

/**
 * Enforce a limit for a route. Returns a 429 `NextResponse` (with `Retry-After`)
 * when the caller is over budget, or `null` to proceed.
 */
export async function enforceRateLimit(options: EnforceOptions): Promise<NextResponse | null> {
  const key = `${options.route}:${options.identity}`;
  const result = await checkRateLimit(key, options.limit, options.windowMs);

  if (result.ok) {
    return null;
  }

  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
