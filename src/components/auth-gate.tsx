import { KeyRound, Loader2, Search } from "lucide-react";

import { ApiKeyPanel } from "@/components/api-key-panel";
import { ScoutMark } from "@/components/brand";
import {
  FIXTURE_SUMMARIES,
  type FixtureChoice,
} from "@/lib/app/scout-client";

export function AuthGate({
  loading = false,
  title,
  message,
  signInAvailable,
  signInProblemMessage,
  apiKeyMode = false,
  apiKeyValue = "",
  onApiKeyChange,
  onApiKeyClear,
  fixtures,
  onSelectFixture,
}: {
  loading?: boolean;
  title: string;
  message: string;
  signInAvailable: boolean;
  signInProblemMessage: string | null;
  apiKeyMode?: boolean;
  apiKeyValue?: string;
  onApiKeyChange?: (value: string) => void;
  onApiKeyClear?: () => void;
  fixtures: FixtureChoice[];
  onSelectFixture: (choice: FixtureChoice) => void;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-5 py-20">
      <div className="ambient anim-breathe" style={{ width: 700, height: 700, top: "5%", left: "10%", background: "var(--glow-1)" }} />
      <div className="ambient anim-breathe" style={{ width: 500, height: 500, bottom: "8%", right: "8%", background: "var(--glow-2)", animationDelay: "-4s" }} />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center anim-up">
        <div className="mb-6 anim-float">
          <ScoutMark size="xl" />
        </div>

        <h1 className="mb-2 text-center text-[38px] font-semibold tracking-tight sm:text-[48px]" style={{ color: "var(--fg)" }}>
          {title}
        </h1>
        <p className="mx-auto mb-10 max-w-[360px] text-center text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
          {message}
        </p>

        <div className="w-full max-w-sm">
          <div
            className="glass glass-clean gradient-border px-6 py-6"
            style={{ background: "var(--card-bg)", borderRadius: 20 }}
          >
            {loading ? (
              <div className="flex flex-col items-center py-6">
                <Loader2 size={22} className="mb-4 animate-spin" style={{ color: "var(--emerald)" }} />
                <p className="text-[14px] font-medium" style={{ color: "var(--fg)" }}>
                  Checking session...
                </p>
              </div>
            ) : apiKeyMode ? (
              <ApiKeyPanel
                value={apiKeyValue}
                disabled={false}
                onChange={(value) => onApiKeyChange?.(value)}
                onClear={() => onApiKeyClear?.()}
              />
            ) : signInAvailable ? (
              <a
                href="/api/auth/codex/start?returnTo=/"
                className="btn-primary w-full"
              >
                <KeyRound size={15} />
                Continue with Codex
              </a>
            ) : (
              <div
                className="rounded-[12px] px-4 py-3 text-[12px] leading-relaxed"
                style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.14)", color: "rgb(252 211 77)" }}
              >
                {signInProblemMessage ?? "Codex sign-in is not available on this deployment."}
              </div>
            )}

            <div className="section-divider my-6">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--faint)" }}>
                Try a demo
              </span>
            </div>

            <div className="space-y-2">
              {fixtures.map((choice, i) => (
                <button
                  key={choice.key}
                  type="button"
                  onClick={() => onSelectFixture(choice)}
                  className="glass-inner card-hover w-full rounded-[14px] px-4 py-3 text-left stagger-item"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--btn-secondary-border)" }}
                    >
                      <Search size={13} style={{ color: "var(--emerald-dim)" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>
                        {choice.label}
                      </div>
                      <div className="text-[10px] leading-relaxed" style={{ color: "var(--muted)" }}>
                        {FIXTURE_SUMMARIES[choice.key] ?? choice.input}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
