import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSession, asErrorResponse } from "@/server/route-helpers";
import { saveDraft } from "@/server/workspace";

const DraftSchema = z.object({
  to: z.string().min(1),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  threadId: z.string().optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const input = DraftSchema.parse(await request.json());
    const payload = await saveDraft(session.tenantId, session, input);
    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
