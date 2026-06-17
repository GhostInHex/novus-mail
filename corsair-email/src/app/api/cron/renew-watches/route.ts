import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { log } from "@/server/log";
import { renewAllWatches } from "@/server/watches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  if (!env.CRON_SECRET) {
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function run(request: Request) {
  // Disabled unless CRON_SECRET is set; Vercel Cron sends it as a Bearer token.
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await renewAllWatches();
    return NextResponse.json({
      ok: true,
      renewed: summary.renewed,
      skipped: summary.skipped,
      errors: summary.errors,
      outcomes: summary.outcomes,
    });
  } catch (error) {
    log.error("cron_renew_watches_failed", { error });
    return NextResponse.json({ ok: false, error: "Renewal failed" }, { status: 500 });
  }
}

// Vercel Cron issues a GET; POST is accepted for manual triggering.
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
