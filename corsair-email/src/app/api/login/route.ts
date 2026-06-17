import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { ROUTES } from "@/lib/routes";
import { buildTenantId, setSession } from "@/lib/session";
import { clientIp, enforceRateLimit } from "@/server/rate-limit";
import { ensureTenant } from "@/server/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Unverified email login is a dev/demo convenience only. In production the
  // real identity path is Google sign-in (/api/auth/google/start).
  if (!env.ALLOW_EMAIL_LOGIN) {
    return NextResponse.json(
      { error: "Email login is disabled. Use Sign in with Google." },
      { status: 403 },
    );
  }

  const limited = await enforceRateLimit({
    identity: clientIp(request),
    route: "login",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (!email || !displayName) {
    return NextResponse.redirect(new URL(ROUTES.start, request.url));
  }

  const session = {
    tenantId: buildTenantId(email),
    email,
    displayName,
  };

  await ensureTenant(session);

  const response = NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  setSession(response, session);
  return response;
}
