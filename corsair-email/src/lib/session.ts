import crypto from "node:crypto";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

import { env } from "@/lib/env";
import type { SessionUser } from "@/lib/types";
import { slugify } from "@/lib/utils";

const COOKIE_NAME = "corsair-mail-session";
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NEXT_PUBLIC_APP_URL.startsWith("https://"),
  path: "/",
  maxAge: 60 * 60 * 24 * 14,
} as const;

function sign(payload: string) {
  return crypto.createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

function encodeSession(session: SessionUser) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(raw: string | undefined) {
  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");

  if (!payload || !signature || sign(payload) !== signature) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

export function buildTenantId(email: string) {
  return slugify(email) || "workspace";
}

export async function getSession() {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(COOKIE_NAME)?.value);
}

export function setSession(response: NextResponse, session: SessionUser) {
  response.cookies.set(COOKIE_NAME, encodeSession(session), SESSION_COOKIE_OPTIONS);
}

export function clearSession(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
