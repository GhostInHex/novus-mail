import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { ROUTES } from "@/lib/routes";
import { setSession } from "@/lib/session";
import { buildDemoSession } from "@/server/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!env.DEMO_LOGIN_ENABLED) {
    return NextResponse.json({ error: "Demo access is disabled." }, { status: 403 });
  }

  const response = NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  setSession(response, buildDemoSession());
  return response;
}
