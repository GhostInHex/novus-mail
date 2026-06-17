import { NextResponse } from "next/server";

import { requireSession, asErrorResponse } from "@/server/route-helpers";
import { getThreadDetail } from "@/server/workspace";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ threadId: string }>;
  },
) {
  try {
    const session = await requireSession();
    const { threadId } = await context.params;
    const payload = await getThreadDetail(session.tenantId, threadId);
    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
