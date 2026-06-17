import { NextResponse } from "next/server";

import { isAiConfigured } from "@/server/ai";
import { getAppDb } from "@/server/corsair-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated liveness/readiness probe. Runs a trivial `SELECT 1` so load
 * balancers and uptime checks can tell whether the app can reach Postgres.
 * Returns 200 when healthy, 503 when the database is unreachable. No secrets.
 */
export async function GET() {
  const startedAt = Date.now();
  let db = false;

  try {
    const sql = await getAppDb();
    await sql`SELECT 1`;
    db = true;
  } catch {
    db = false;
  }

  return NextResponse.json(
    {
      status: db ? "ok" : "degraded",
      db,
      ai: isAiConfigured(),
      latencyMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    },
    {
      status: db ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
