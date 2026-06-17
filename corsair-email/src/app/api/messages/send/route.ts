import { NextResponse } from "next/server";
import { z } from "zod";

import { asErrorResponse, readLimitedJson, requireSession } from "@/server/route-helpers";
import { enforceRateLimit } from "@/server/rate-limit";
import { sendEmail } from "@/server/workspace";

const ComposeSchema = z.object({
  to: z.string().min(1).max(2_000),
  cc: z.string().max(2_000).optional(),
  bcc: z.string().max(2_000).optional(),
  subject: z.string().min(1).max(2_000),
  body: z.string().min(1).max(100_000),
  threadId: z.string().max(256).optional(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const limited = await enforceRateLimit({
      identity: session.tenantId,
      route: "send",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) {
      return limited;
    }

    const input = ComposeSchema.parse(await readLimitedJson(request, 200_000));
    const payload = await sendEmail(session.tenantId, session, input);
    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
