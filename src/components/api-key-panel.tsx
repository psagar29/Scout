import { ExternalLink, KeyRound, X } from "lucide-react";

export function ApiKeyPanel({
  value,
  disabled,
  onChange,
  onClear,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
}) {
  const hasValue = value.trim().length > 0;

  return (
    <div
      className="glass glass-clean mt-3 px-4 py-4"
      style={{
        background: "var(--card-bg)",
        border: "1px solid var(--border-mid)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--btn-secondary-border)" }}
        >
          <KeyRound size={14} style={{ color: "var(--emerald-dim)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label
              className="label-caps"
              htmlFor="openai-api-key"
            >
              OpenAI API key
            </label>
            <a
              href="https://platform.openai.com/settings/organization/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-medium transition-colors hover:text-[var(--fg)]"
              style={{ color: "var(--muted)" }}
            >
              Get key
              <ExternalLink size={9} />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="openai-api-key"
              type="password"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-..."
              className="input-glow h-10 min-w-0 flex-1 rounded-[12px] bg-transparent px-3 text-[13px] outline-none placeholder:text-[var(--faint)] disabled:opacity-50"
              style={{ border: "1px solid var(--border)", color: "var(--fg)", caretColor: "var(--emerald)" }}
            />
            {hasValue && (
              <button
                type="button"
                onClick={onClear}
                disabled={disabled}
                aria-label="Forget API key"
                className="btn-icon !h-10 !w-10 !rounded-[12px]"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "var(--faint)" }}>
            Stored only in this browser tab. Not saved on any server.
          </p>
        </div>
      </div>
    </div>
  );
}
