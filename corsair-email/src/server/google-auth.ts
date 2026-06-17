import crypto from "node:crypto";

import { env, isGoogleLoginConfigured } from "@/lib/env";

/**
 * Google "Sign in with Google" — OpenID Connect authorization-code flow for
 * *identity only* (verified email + name). This is intentionally separate from
 * the Gmail/Calendar data-access OAuth that Corsair manages: this client never
 * requests Gmail scopes and its tokens are not stored.
 *
 * Implemented with `fetch` and Node crypto — no extra dependency.
 */

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SCOPE = "openid email profile";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export const OAUTH_STATE_COOKIE = "corsair-oauth-state";

export function googleLoginConfigured(): boolean {
  return isGoogleLoginConfigured();
}

export function redirectUri(): string {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/auth/google/callback`;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

type StatePayload = {
  state: string;
  nonce: string;
  redirectTo: string;
  iat: number;
};

/** Mint a CSRF `state`, a replay-guard `nonce`, and a signed cookie value carrying both. */
export function createStateCookie(redirectTo: string) {
  const safeRedirectTo = redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "/";

  const payload: StatePayload = {
    state: crypto.randomBytes(16).toString("base64url"),
    nonce: crypto.randomBytes(16).toString("base64url"),
    redirectTo: safeRedirectTo,
    iat: Date.now(),
  };

  const encoded = base64url(JSON.stringify(payload));
  const cookieValue = `${encoded}.${sign(encoded)}`;

  return { payload, cookieValue };
}

export function parseStateCookie(raw: string | undefined): StatePayload | null {
  if (!raw) {
    return null;
  }

  const [encoded, signature] = raw.split(".");
  if (!encoded || !signature || !timingSafeEqual(sign(encoded), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as StatePayload;
    if (!payload.state || !payload.nonce || Date.now() - payload.iat > STATE_MAX_AGE_MS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildAuthorizeUrl(state: string, nonce: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    state,
    nonce,
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export type GoogleIdentity = {
  email: string;
  name: string;
  emailVerified: boolean;
};

/**
 * Exchange the authorization `code` for tokens and read the verified identity
 * from the `id_token`. The token comes straight from Google's token endpoint
 * over TLS, so per Google's documented guidance we can trust its claims without
 * a separate JWKS signature check. We still verify `aud`, `iss`, and `nonce`.
 * (JWKS signature verification is a reasonable optional hardening step.)
 */
export async function exchangeCodeForIdentity(code: string, expectedNonce: string): Promise<GoogleIdentity> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed (${response.status}).`);
  }

  const data = (await response.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new Error("Google token response missing id_token.");
  }

  const claims = decodeIdTokenClaims(data.id_token);

  const validIssuer = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!validIssuer) {
    throw new Error("Unexpected id_token issuer.");
  }
  if (claims.aud !== env.GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error("id_token audience mismatch.");
  }
  if (!claims.nonce || claims.nonce !== expectedNonce) {
    throw new Error("id_token nonce mismatch.");
  }
  if (!claims.email) {
    throw new Error("id_token missing email claim.");
  }

  const emailVerified = claims.email_verified === true || claims.email_verified === "true";
  if (!emailVerified) {
    throw new Error("Google account email is not verified.");
  }

  return {
    email: claims.email.toLowerCase(),
    name: claims.name?.trim() || claims.email.split("@")[0],
    emailVerified,
  };
}

type IdTokenClaims = {
  iss?: string;
  aud?: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
};

function decodeIdTokenClaims(idToken: string): IdTokenClaims {
  const segment = idToken.split(".")[1];
  if (!segment) {
    throw new Error("Malformed id_token.");
  }
  return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as IdTokenClaims;
}
