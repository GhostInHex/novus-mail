import { NextResponse } from "next/server";

import { asErrorResponse, requireSession } from "@/server/route-helpers";
import { expandInboxCache } from "@/server/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const target = Number(searchParams.get("target") ?? "");
    const payload = await expandInboxCache(session.tenantId, {
      target: Number.isFinite(target) && target > 0 ? target : undefined,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
