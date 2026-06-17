import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { log } from "@/server/log";

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return session;
}

/**
 * Read and JSON-parse a request body with a hard byte cap. Throws a (pre-built)
 * 413 response when oversized and a 400 on malformed JSON — both pass cleanly
 * through `asErrorResponse`. Guards the AI/command routes against cost/DoS via
 * giant payloads.
 */
export async function readLimitedJson(request: Request, maxBytes = 100_000): Promise<unknown> {
  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}

/**
 * Normalises a thrown value into a JSON error response.
 *
 * - An already-built `NextResponse` (e.g. the 401 from `requireSession`) passes through.
 * - Validation errors become a 400.
 * - Everything else is logged server-side; the client gets a generic 500 in
 *   production (no `error.message` leakage) and the real message in development.
 */
export function asErrorResponse(error: unknown) {
  if (error instanceof NextResponse) {
    return error;
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", details: env.IS_PRODUCTION ? undefined : error.issues },
      { status: 400 },
    );
  }

  log.error("route_error", { error });

  const message = env.IS_PRODUCTION
    ? "Something went wrong. Please try again."
    : error instanceof Error
      ? error.message
      : "Unknown server error";

  return NextResponse.json({ error: message }, { status: 500 });
}
