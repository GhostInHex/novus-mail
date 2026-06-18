import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { ROUTES } from "@/lib/routes";
import {
  OAUTH_STATE_COOKIE,
  buildAuthorizeUrl,
  createStateCookie,
  googleLoginConfigured,
} from "@/server/google-auth";
import { clientIp, enforceRateLimit } from "@/server/rate-limit";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!googleLoginConfigured()) {
    return NextResponse.json(
      { error: "Google sign-in is not configured." },
      { status: 503 },
    );
  }

  const limited = await enforceRateLimit({
    identity: clientIp(request),
    route: "auth-start",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  const { searchParams } = new URL(request.url);
  const redirectTo = searchParams.get("redirectTo") ?? ROUTES.dashboard;
  const cookieStore = await cookies();
  const { payload, cookieValue } = createStateCookie(
    redirectTo,
    cookieStore.get(OAUTH_STATE_COOKIE)?.value,
  );

  const response = NextResponse.redirect(buildAuthorizeUrl(payload.state, payload.nonce));
  response.cookies.set(OAUTH_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
    path: "/",
    maxAge: 600,
  });

  return response;
}
