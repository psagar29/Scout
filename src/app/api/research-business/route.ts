import { NextRequest } from "next/server";
import { z } from "zod";

import {
  synthesizeRiskReportWithCodex,
  synthesizeRiskReportWithOpenAI,
} from "@/lib/ai/responses";
import {
  clearCodexSessionCookieHeaders,
  codexOAuthConfigurationProblem,
  codexOAuthProblemMessage,
  codexSessionCookieHeaders,
  resolveCodexSession,
} from "@/lib/auth/codex-oauth";
import {
  requestAppOrigin,
  researchGenerationStatusFor,
} from "@/lib/ai/generation-provider";
import { researchBusiness } from "@/lib/research/orchestrator";

export const runtime = "nodejs";

const requestSchema = z.object({
  input: z.string().min(3).max(4000),
  demoMode: z.boolean().optional().default(false),
});

function openAIAPIKeyFromRequest(request: NextRequest) {
  const value = request.headers.get("x-openai-api-key")?.trim();
  return value ? value : null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsedBody = requestSchema.safeParse(body);

  if (!parsedBody.success) {
    return Response.json(
      { error: "Provide a business website, Google Maps URL, or business name + city." },
      { status: 400 },
    );
  }

  const { input, demoMode } = parsedBody.data;
  if (demoMode) {
    const result = await researchBusiness(input, { demoMode: true });
    return Response.json({
      report: result.report,
      source: "fixture",
      model: result.model,
    });
  }

  const appOrigin = requestAppOrigin(request);
  const codexProblem = codexOAuthConfigurationProblem(appOrigin);
  const generation = researchGenerationStatusFor(appOrigin, !codexProblem);

  if (!generation.available) {
    return Response.json(
      {
        error:
          generation.provider === "codex"
            ? codexOAuthProblemMessage(codexProblem) ?? generation.message
            : generation.message,
        source: generation.provider,
      },
      { status: 503 },
    );
  }

  if (generation.provider === "openai") {
    const apiKey = openAIAPIKeyFromRequest(request);
    if (!apiKey) {
      return Response.json(
        {
          error: "Enter your OpenAI API key for this browser session.",
          source: "openai",
        },
        { status: 400 },
      );
    }

    try {
      const result = await researchBusiness(input, {
        demoMode: false,
        synthesizer: (payload) =>
          synthesizeRiskReportWithOpenAI(apiKey, payload),
      });

      return Response.json({
        report: result.report,
        source: "openai",
        model: result.model,
      });
    } catch (error) {
      console.error(
        "OpenAI research generation failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
      return Response.json(
        {
          error:
            "OpenAI generation failed. Check quota, model access, or source availability.",
          source: "openai",
        },
        { status: 502 },
      );
    }
  }

  const codexSession = await resolveCodexSession(request.cookies);
  if (!codexSession) {
    const response = Response.json(
      {
        error: "Sign in with Codex to run Broker Scout research.",
        source: "codex",
      },
      { status: 401 },
    );
    for (const cookie of clearCodexSessionCookieHeaders()) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  }

  try {
    const result = await researchBusiness(input, {
      demoMode: false,
      synthesizer: (payload) =>
        synthesizeRiskReportWithCodex(codexSession, payload),
    });

    const response = Response.json({
      report: result.report,
      source: "codex",
      model: result.model,
    });
    for (const cookie of await codexSessionCookieHeaders(codexSession)) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error(
      "Codex research generation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    const response = Response.json(
      {
        error: "Codex generation failed. The selected provider did not return a report.",
        source: "codex",
      },
      { status: 502 },
    );
    for (const cookie of await codexSessionCookieHeaders(codexSession)) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  }
}
