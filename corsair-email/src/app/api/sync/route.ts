import { NextResponse } from "next/server";

import { requireSession, asErrorResponse } from "@/server/route-helpers";
import { syncWorkspace } from "@/server/workspace";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireSession();
    const payload = await syncWorkspace(session.tenantId);
    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
