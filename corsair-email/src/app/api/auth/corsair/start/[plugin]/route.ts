import { NextResponse } from "next/server";
import { generateOAuthUrl } from "corsair/oauth";

import { ROUTES } from "@/lib/routes";
import {
  corsairOAuthRedirectUri,
  isConnectPlugin,
  isCorsairOAuthConfigError,
} from "@/server/corsair-oauth";
import { getCorsair } from "@/server/corsair-client";
import { log } from "@/server/log";
import { enforceRateLimit } from "@/server/rate-limit";
import { requireSession } from "@/server/route-helpers";
import { ensureTenant } from "@/server/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function connectionRedirect(request: Request, code: string) {
  const url = new URL(ROUTES.connect, request.url);
  url.searchParams.set("connection_error", code);
  return NextResponse.redirect(url);
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ plugin: string }>;
  },
) {
  const { plugin } = await context.params;
  if (!isConnectPlugin(plugin)) {
    return NextResponse.json({ error: "Unknown connection provider." }, { status: 404 });
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.redirect(new URL(ROUTES.start, request.url));
  }

  const limited = await enforceRateLimit({
    identity: session.tenantId,
    route: `corsair-oauth-start:${plugin}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) {
    return limited;
  }

  try {
    await ensureTenant(session);

    const { url } = await generateOAuthUrl(await getCorsair(), plugin, {
      tenantId: session.tenantId,
      redirectUri: corsairOAuthRedirectUri(),
    });

    return NextResponse.redirect(url);
  } catch (error) {
    log.error("corsair_oauth_start_failed", {
      tenantId: session.tenantId,
      plugin,
      error,
    });

    return connectionRedirect(
      request,
      isCorsairOAuthConfigError(error) ? "missing_config" : "oauth_failed",
    );
  }
}
