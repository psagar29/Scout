import { isLoopbackUrl } from "@/lib/auth/codex-oauth";

export type GenerationProvider = "codex" | "openai";
export type GenerationMode = GenerationProvider | "auto";

export type GenerationStatus = {
  mode: GenerationMode;
  provider: GenerationProvider;
  signInRequired: boolean;
  apiKeyRequired: boolean;
  available: boolean;
  message: string | null;
};

type RequestLike = {
  url: string;
  headers: Headers;
};

function configuredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function requestAppOrigin(request: RequestLike) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto ?? requestUrl.protocol.replace(/:$/u, "");

  return host ? `${proto}://${host}` : requestUrl.origin;
}

export function researchGenerationMode(): GenerationMode {
  const mode = configuredEnv("BROKER_SCOUT_AI_PROVIDER")?.toLowerCase();

  if (mode === "codex" || mode === "openai" || mode === "auto") {
    return mode;
  }

  return "auto";
}

export function researchGenerationProviderFor(
  appOrigin: string,
): GenerationProvider {
  const mode = researchGenerationMode();
  if (mode === "codex" || mode === "openai") return mode;

  return isLoopbackUrl(appOrigin) ? "codex" : "openai";
}

export function researchGenerationStatusFor(
  appOrigin: string,
  codexSignInAvailable: boolean,
): GenerationStatus {
  const mode = researchGenerationMode();
  const provider = researchGenerationProviderFor(appOrigin);

  if (provider === "openai") {
    return {
      mode,
      provider,
      signInRequired: false,
      apiKeyRequired: true,
      available: true,
      message: null,
    };
  }

  return {
    mode,
    provider,
    signInRequired: true,
    apiKeyRequired: false,
    available: codexSignInAvailable,
    message: codexSignInAvailable
      ? null
      : "Codex sign-in is not available for this host and redirect configuration.",
  };
}
