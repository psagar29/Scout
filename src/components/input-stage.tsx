import { Loader2, Search, Send } from "lucide-react";
import type { RefObject } from "react";

import { ApiKeyPanel } from "@/components/api-key-panel";
import { ScoutMark } from "@/components/brand";
import {
  FIXTURE_SUMMARIES,
  type ExampleChip,
  type FixtureChoice,
} from "@/lib/app/scout-client";

export function InputStage({
  inputRef,
  query,
  onQueryChange,
  onSubmit,
  isBusy,
  generationRequiresApiKey,
  openAIKey,
  onOpenAIKeyChange,
  onOpenAIKeyClear,
  examples,
  fixtures,
  error,
  generationAvailable,
  generationMessage,
  onSelectFixture,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  isBusy: boolean;
  generationRequiresApiKey: boolean;
  openAIKey: string;
  onOpenAIKeyChange: (value: string) => void;
  onOpenAIKeyClear: () => void;
  examples: ExampleChip[];
  fixtures: FixtureChoice[];
  error: string | null;
  generationAvailable: boolean;
  generationMessage: string | null;
  onSelectFixture: (choice: FixtureChoice) => void;
}) {
  return (
    <div className="relative z-10 flex min-h-[calc(100vh-48px)] items-center justify-center">
      <div className="w-full max-w-2xl anim-up">
        <div className="mb-6 flex justify-center anim-float">
          <ScoutMark size="xl" />
        </div>

        <h1
          className="mb-2 text-center text-[40px] font-semibold tracking-tight sm:text-[56px]"
          style={{ color: "var(--fg)" }}
        >
          Scout
        </h1>
        <p
          className="mx-auto mb-10 max-w-md text-center text-[15px] leading-relaxed"
          style={{ color: "var(--muted)" }}
        >
          Autonomous pre-call research for commercial insurance brokers.
        </p>

        <div
          className="glass glass-clean gradient-border input-glow px-5 py-4 sm:px-6"
          style={{ background: "var(--card-bg)", borderRadius: 20 }}
        >
          <div className="flex items-center gap-3">
            <Search
              size={18}
              style={{ color: "var(--faint)", flexShrink: 0 }}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isBusy) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Business website, Google Maps URL, or name + city"
              className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--faint)]"
              style={{ color: "var(--fg)", caretColor: "var(--emerald)" }}
            />
            <button
              type="button"
              onClick={onSubmit}
              disabled={isBusy}
              className="btn-primary !h-10 !w-10 !p-0 shrink-0 !rounded-[12px]"
              aria-label="Run research"
            >
              {isBusy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={15} />
              )}
            </button>
          </div>
        </div>

        {generationRequiresApiKey ? (
          <ApiKeyPanel
            value={openAIKey}
            disabled={isBusy}
            onChange={onOpenAIKeyChange}
            onClear={onOpenAIKeyClear}
          />
        ) : null}

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {examples.map((example, index) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onQueryChange(example.query)}
              className="tag stagger-item transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
              style={
                {
                  background: "var(--btn-secondary-bg)",
                  border: "1px solid var(--btn-secondary-border)",
                  color: "var(--muted)",
                  cursor: "pointer",
                  "--i": index,
                } as React.CSSProperties
              }
            >
              {example.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {fixtures.map((choice, index) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => onSelectFixture(choice)}
              className="glass-inner card-hover rounded-[16px] px-4 py-4 text-left stagger-item"
              style={{ "--i": index + 4 } as React.CSSProperties}
            >
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                  style={{
                    background: "var(--btn-secondary-bg)",
                    border: "1px solid var(--btn-secondary-border)",
                  }}
                >
                  <Search size={12} style={{ color: "var(--emerald-dim)" }} />
                </div>
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: "var(--fg)" }}
                >
                  {choice.label}
                </span>
              </div>
              <div
                className="text-[11px] leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                {FIXTURE_SUMMARIES[choice.key] ?? choice.input}
              </div>
              <div
                className="mt-3 inline-flex rounded-[8px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]"
                style={{
                  background: "rgba(245,158,11,0.06)",
                  color: "rgb(253 224 71)",
                }}
              >
                Demo
              </div>
            </button>
          ))}
        </div>

        {error ? (
          <div
            className="mt-5 mx-auto max-w-md rounded-[12px] px-4 py-3 text-center text-[13px] font-medium anim-fade"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.12)",
              color: "rgb(252 165 165)",
            }}
          >
            {error}
          </div>
        ) : null}

        {!generationAvailable ? (
          <p
            className="mt-5 text-center text-[12px] leading-relaxed"
            style={{ color: "rgb(253 224 71)" }}
          >
            {generationMessage ??
              "Research provider is not configured for this deployment."}
          </p>
        ) : null}

        <div
          className="mt-10 text-center text-[11px] leading-relaxed"
          style={{ color: "var(--faint)" }}
        >
          Coverage recommendations are broker-prep considerations, not licensed
          insurance advice.
          <br />
          Verify all findings with the insured and carrier underwriting
          guidelines.
        </div>
      </div>
    </div>
  );
}
