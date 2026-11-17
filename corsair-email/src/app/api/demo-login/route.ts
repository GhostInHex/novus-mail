import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { ROUTES } from "@/lib/routes";
import { setSession } from "@/lib/session";
import { buildDemoSession } from "@/server/demo";

export const runtime = "nodejs";
const previewEmailSchema = z.string().trim().email();

export async function POST(request: Request) {
  if (!env.DEMO_LOGIN_ENABLED) {
    return NextResponse.json({ error: "Demo access is disabled." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const form = /multipart\/form-data|application\/x-www-form-urlencoded/.test(contentType)
    ? await request.formData().catch(() => null)
    : new FormData();
  if (!form) return NextResponse.json({ error: "Unable to read the sign-in form." }, { status: 400 });
  const value = form.get("email");
  const session = buildDemoSession();
  if (value !== null && value !== "") {
    const email = previewEmailSchema.safeParse(value);
    if (!email.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    session.email = email.data;
  }
  const response = NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  setSession(response, session);
  return response;
}
