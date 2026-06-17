import { NextResponse } from "next/server";
import { z } from "zod";

import { asErrorResponse, readLimitedJson, requireSession } from "@/server/route-helpers";
import { enforceRateLimit } from "@/server/rate-limit";
import { runCommand } from "@/server/workspace";

const CommandSchema = z.object({
  command: z.string().min(1).max(2_000),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    const limited = await enforceRateLimit({
      identity: session.tenantId,
      route: "command",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) {
      return limited;
    }

    const input = CommandSchema.parse(await readLimitedJson(request, 16_000));
    const payload = await runCommand(session.tenantId, session, input.command);
    return NextResponse.json(payload);
  } catch (error) {
    return asErrorResponse(error);
  }
}
