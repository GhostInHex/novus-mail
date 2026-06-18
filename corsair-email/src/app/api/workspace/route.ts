import { NextResponse } from "next/server";

import { requireSession, asErrorResponse } from "@/server/route-helpers";
import { loadWorkspace } from "@/server/workspace";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const remote = searchParams.get("remote") === "1";
    const limit = Number(searchParams.get("limit") ?? "");
    const offset = Number(searchParams.get("offset") ?? "");
    const payload = await loadWorkspace(session.tenantId, search, {
      remote,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      offset: Number.isFinite(offset) && offset >= 0 ? offset : undefined,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
