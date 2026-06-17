import { NextResponse } from "next/server";
import { z } from "zod";

import { asErrorResponse, readLimitedJson, requireSession } from "@/server/route-helpers";
import { enforceRateLimit } from "@/server/rate-limit";
import { updateEvent } from "@/server/workspace";

const EventSchema = z.object({
  summary: z.string().min(1).max(2_000),
  description: z.string().max(20_000).optional(),
  location: z.string().max(2_000).optional(),
  start: z.string().min(1).max(64),
  end: z.string().min(1).max(64),
  attendees: z.string().max(4_000).optional(),
});

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const session = await requireSession();

    const limited = await enforceRateLimit({
      identity: session.tenantId,
      route: "events-update",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) {
      return limited;
    }

    const input = EventSchema.parse(await readLimitedJson(request, 32_000));
    const { id } = await context.params;
    const payload = await updateEvent(session.tenantId, { id, ...input });
    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
