import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession, asErrorResponse } from "@/server/route-helpers";
import { runThreadAction } from "@/server/workspace";

const ActionSchema = z.object({
  action: z.enum(["archive", "unarchive", "star", "unstar", "read", "unread", "trash", "untrash"]),
});

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ threadId: string }>;
  },
) {
  try {
    const session = await requireSession();
    const { threadId } = await context.params;
    const input = ActionSchema.parse(await request.json());
    const payload = await runThreadAction(session.tenantId, threadId, input.action);
    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
