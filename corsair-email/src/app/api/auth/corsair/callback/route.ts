import { NextResponse } from "next/server";
import { processOAuthCallback } from "corsair/oauth";

import { ROUTES } from "@/lib/routes";
import { corsairOAuthRedirectUri, isCorsairOAuthConfigError } from "@/server/corsair-oauth";
import { getCorsair } from "@/server/corsair-client";
import { log } from "@/server/log";
import { enforceRateLimit } from "@/server/rate-limit";
import { requireSession } from "@/server/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function connectionRedirect(request: Request, code?: string) {
  const url = new URL(code ? ROUTES.connect : ROUTES.dashboard, request.url);
  if (code) {
    url.searchParams.set("connection_error", code);
  }
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return connectionRedirect(request);
  }

  const limited = await enforceRateLimit({
    identity: session.tenantId,
    route: "corsair-oauth-callback",
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

  if (oauthError) {
    log.warn("corsair_oauth_denied", { tenantId: session.tenantId, oauthError });
    return connectionRedirect(request, "oauth_denied");
  }

  if (!code || !state) {
    return connectionRedirect(request, "oauth_failed");
  }

  try {
    const result = await processOAuthCallback(await getCorsair(), {
      code,
      state,
      redirectUri: corsairOAuthRedirectUri(),
    });

    if (result.tenantId !== session.tenantId) {
      log.warn("corsair_oauth_tenant_mismatch", {
        sessionTenantId: session.tenantId,
        resultTenantId: result.tenantId,
        plugin: result.plugin,
      });
      return connectionRedirect(request, "tenant_mismatch");
    }

    return connectionRedirect(request);
  } catch (error) {
    log.error("corsair_oauth_callback_failed", {
      tenantId: session.tenantId,
      error,
    });

    return connectionRedirect(
      request,
      isCorsairOAuthConfigError(error) ? "missing_config" : "oauth_failed",
    );
  }
}
