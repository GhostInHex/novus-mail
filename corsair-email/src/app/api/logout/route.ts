import { NextResponse } from "next/server";

import { clearSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  clearSession(response);
  return response;
}
