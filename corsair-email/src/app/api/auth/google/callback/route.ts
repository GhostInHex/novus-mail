import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { ROUTES } from "@/lib/routes";
import { buildTenantId, setSession } from "@/lib/session";
import {
  OAUTH_STATE_COOKIE,
  exchangeCodeForIdentity,
  googleLoginConfigured,
  parseStateCookie,
} from "@/server/google-auth";
import { log } from "@/server/log";
import { clientIp, enforceRateLimit } from "@/server/rate-limit";
import { ensureTenant } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(request: Request, reason: string) {
  log.warn("google_login_failed", { reason });
  const url = new URL(ROUTES.start, request.url);
  url.searchParams.set("login_error", "google");
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  if (!googleLoginConfigured()) {
    return NextResponse.json({ error: "Google sign-in is not configured." }, { status: 503 });
  }

  const limited = await enforceRateLimit({
    identity: clientIp(request),
    route: "auth-callback",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const cookieStore = await cookies();
  const stateCookie = parseStateCookie(cookieStore.get(OAUTH_STATE_COOKIE)?.value);
  // One-time use: clear the state cookie regardless of outcome.
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (oauthError) {
    return failure(request, `provider_error:${oauthError}`);
  }
  if (!code || !state || !stateCookie) {
    return failure(request, "missing_params_or_state");
  }
  if (state !== stateCookie.state) {
    return failure(request, "state_mismatch");
  }

  try {
    const identity = await exchangeCodeForIdentity(code, stateCookie.nonce);
    const session = {
      tenantId: buildTenantId(identity.email),
      email: identity.email,
      displayName: identity.name,
    };

    await ensureTenant(session);

    const response = NextResponse.redirect(new URL(stateCookie.redirectTo || ROUTES.dashboard, request.url));
    setSession(response, session);
    return response;
  } catch (error) {
    log.error("google_login_exchange_failed", { error });
    return failure(request, "exchange_failed");
  }
}
