import { NextResponse } from "next/server";

import { asErrorResponse, requireSession } from "@/server/route-helpers";
import { getSyncStatus } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cheap change-detection endpoint for the client polling fallback: returns the
 * tenant's last inbox/calendar sync timestamps so the browser can decide
 * whether to reload the full workspace.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const status = await getSyncStatus(session.tenantId);
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return asErrorResponse(error);
  }
}
