import { createServer, type Server, type ServerResponse } from "node:http";

import {
  CODEX_PENDING_COOKIE,
  buildAppRedirectUrl,
  clearCodexPendingCookieHeader,
  codexSessionCookieHeaders,
  completeCodexOAuthCode,
} from "@/lib/auth/codex-oauth";

declare global {
  var brokerScoutCodexLoopbackServer: Server | undefined;
  var brokerScoutCodexLoopbackServerPromise: Promise<void> | undefined;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function callbackHtml(success: boolean, message: string, redirectUrl?: string) {
  const title = success ? "Authentication successful" : "Authentication failed";
  const accent = success ? "#0f8a63" : "#a53c29";
  const safeRedirect = redirectUrl ? escapeHtml(redirectUrl) : null;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${safeRedirect ? `<meta http-equiv="refresh" content="1;url=${safeRedirect}" />` : ""}
  <title>${title}</title>
  <style>
    body { margin: 0; background: #090909; color: #f2f2f2; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width: 560px; margin: 80px auto; padding: 28px; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; background: rgba(18,18,18,0.94); box-shadow: 0 24px 60px rgba(0,0,0,0.45); }
    .eyebrow { margin-bottom: 12px; color: ${accent}; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
    h1 { margin: 0 0 10px; font-size: 24px; }
    p { margin: 0; color: #b3b3b3; line-height: 1.6; }
    a { color: #e5e5e5; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Broker Scout</div>
    <h1>${title}</h1>
    <p>${escapeHtml(message)}</p>
    ${safeRedirect ? `<p style="margin-top: 14px;"><a href="${safeRedirect}">Return to Broker Scout</a></p>` : ""}
  </main>
</body>
</html>`;
}

function sendHtml(
  response: ServerResponse,
  status: number,
  body: string,
  setCookie?: string | string[],
) {
  response.statusCode = status;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Connection", "close");
  if (setCookie) {
    response.setHeader("Set-Cookie", setCookie);
  }
  response.end(body);
}

function cookieFromHeader(header: string | undefined, name: string) {
  if (!header) return null;
  const cookies = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

async function existingLoopbackServerLooksHealthy() {
  for (const url of [
    "http://localhost:1455/auth/callback",
    "http://127.0.0.1:1455/auth/callback",
    "http://[::1]:1455/auth/callback",
  ]) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1500),
      });
      const body = await response.text();
      if (body.includes("Broker Scout") && body.includes("/auth/callback")) {
        return true;
      }
    } catch {
      // Try the next loopback address.
    }
  }

  return false;
}

export async function ensureCodexLoopbackServer() {
  if (globalThis.brokerScoutCodexLoopbackServer?.listening) {
    return;
  }

  if (globalThis.brokerScoutCodexLoopbackServerPromise) {
    return globalThis.brokerScoutCodexLoopbackServerPromise;
  }

  const server = createServer(async (request, response) => {
    const host = request.headers.host ?? "localhost:1455";
    const url = new URL(request.url ?? "/", `http://${host}`);

    if (request.method !== "GET" || url.pathname !== "/auth/callback") {
      sendHtml(
        response,
        404,
        callbackHtml(
          false,
          "This local Codex callback endpoint only handles /auth/callback.",
        ),
      );
      return;
    }

    const oauthError = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (oauthError) {
      sendHtml(
        response,
        400,
        callbackHtml(false, `Codex sign-in returned ${oauthError}.`),
      );
      return;
    }

    if (!code || !state) {
      sendHtml(
        response,
        400,
        callbackHtml(false, "Codex callback was missing code or state."),
      );
      return;
    }

    try {
      const result = await completeCodexOAuthCode(
        state,
        code,
        cookieFromHeader(request.headers.cookie, CODEX_PENDING_COOKIE),
      );
      const redirectUrl = buildAppRedirectUrl(
        result.pending.appOrigin,
        result.pending.returnTo,
      );
      sendHtml(
        response,
        200,
        callbackHtml(
          true,
          "Authentication completed. Returning to Broker Scout.",
          redirectUrl.toString(),
        ),
        [
          ...(await codexSessionCookieHeaders(result.session)),
          clearCodexPendingCookieHeader(),
        ],
      );
    } catch (error) {
      sendHtml(
        response,
        400,
        callbackHtml(
          false,
          error instanceof Error ? error.message : "Codex sign-in failed.",
        ),
      );
    }
  });

  globalThis.brokerScoutCodexLoopbackServerPromise = new Promise<void>(
    (resolve, reject) => {
      server.once("error", reject);
      server.listen(1455, () => {
        server.off("error", reject);
        globalThis.brokerScoutCodexLoopbackServer = server;
        resolve();
      });
    },
  )
    .catch(async (error: unknown) => {
      const code =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : null;

      if (
        code === "EADDRINUSE" &&
        (await existingLoopbackServerLooksHealthy())
      ) {
        return;
      }

      throw error;
    })
    .finally(() => {
      globalThis.brokerScoutCodexLoopbackServerPromise = undefined;
    });

  return globalThis.brokerScoutCodexLoopbackServerPromise;
}
