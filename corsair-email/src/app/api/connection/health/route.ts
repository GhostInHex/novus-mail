import { NextResponse } from "next/server";

import { asErrorResponse, requireSession } from "@/server/route-helpers";
import { getConnectionHealth } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireSession();
    const status = await getConnectionHealth(session.tenantId);
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return asErrorResponse(error);
  }
}
