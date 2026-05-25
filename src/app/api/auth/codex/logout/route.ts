import { NextRequest, NextResponse } from "next/server";

import {
  clearCodexPendingCookieHeader,
  clearCodexSessionFromCookies,
  clearCodexSessionCookieHeaders,
} from "@/lib/auth/codex-oauth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  await clearCodexSessionFromCookies(request.cookies);

  const response = NextResponse.json({
    signedIn: false,
    provider: "codex",
  });
  for (const cookie of clearCodexSessionCookieHeaders()) {
    response.headers.append("Set-Cookie", cookie);
  }
  response.headers.append("Set-Cookie", clearCodexPendingCookieHeader());

  return response;
}
