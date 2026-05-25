import { CheckCircle2, KeyRound, Loader2, LogOut, Moon, Shield, Sun } from "lucide-react";

export function ThemeToggle({
  light,
  onToggle,
}: {
  light: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="btn-icon"
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
    >
      {light ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
}

export function GitHubChip() {
  return (
    <a
      href="https://github.com/psagar29/scout"
      target="_blank"
      rel="noopener noreferrer"
      className="btn-icon"
      aria-label="GitHub"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.36 6.84 9.71.5.1.68-.22.68-.49 0-.24-.01-1.04-.01-1.89-2.78.62-3.37-1.21-3.37-1.21-.46-1.19-1.11-1.51-1.11-1.51-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.1 0-1.13.39-2.05 1.04-2.78-.1-.26-.45-1.31.1-2.74 0 0 .85-.28 2.78 1.06A9.41 9.41 0 0 1 12 6.84c.85 0 1.71.12 2.51.36 1.93-1.34 2.78-1.06 2.78-1.06.55 1.43.2 2.48.1 2.74.65.73 1.04 1.65 1.04 2.78 0 3.97-2.34 4.83-4.57 5.08.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .27.18.59.69.49A10.27 10.27 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
      </svg>
    </a>
  );
}

const chipStyle = {
  background: "var(--btn-secondary-bg)",
  border: "1px solid var(--btn-secondary-border)",
  color: "var(--fg-secondary)",
} as const;

const chipMutedStyle = {
  background: "var(--btn-secondary-bg)",
  border: "1px solid var(--btn-secondary-border)",
  color: "var(--muted)",
} as const;

export function ProviderChip({
  provider,
  available,
}: {
  provider: "codex" | "openai";
  available: boolean;
}) {
  return (
    <div
      className="inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[12px] font-medium"
      style={chipStyle}
    >
      {provider === "codex" ? <Shield size={13} /> : <KeyRound size={13} />}
      <span>{provider === "codex" ? "Codex" : "OpenAI"}</span>
      <span
        className="indicator-dot"
        style={{
          background: available ? "rgb(16 185 129)" : "rgb(245 158 11)",
          boxShadow: available ? "0 0 6px rgba(16, 185, 129, 0.3)" : "0 0 6px rgba(245, 158, 11, 0.3)",
        }}
      />
    </div>
  );
}

export function AuthChip({
  loading,
  signedIn,
  name,
  signInAvailable,
  onSignOut,
  busy = false,
}: {
  loading: boolean;
  signedIn: boolean;
  name: string | null;
  signInAvailable: boolean;
  onSignOut: () => void;
  busy?: boolean;
}) {
  if (loading) {
    return (
      <div
        className="inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[12px]"
        style={chipMutedStyle}
      >
        <Loader2 size={12} className="animate-spin" />
        <span>Checking</span>
      </div>
    );
  }

  if (!signedIn) {
    if (!signInAvailable) {
      return (
        <div
          className="inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[12px] font-medium"
          style={chipMutedStyle}
        >
          <KeyRound size={12} />
          Unavailable
        </div>
      );
    }

    return (
      <a
        href="/signin"
        className="inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[12px] font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        style={chipStyle}
      >
        <KeyRound size={12} />
        Sign in
      </a>
    );
  }

  return (
    <div
      className="inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[12px]"
      style={chipStyle}
    >
      <CheckCircle2 size={12} style={{ color: "rgb(16 185 129)" }} />
      <span className="max-w-[100px] truncate">{name ?? "Connected"}</span>
      <button
        type="button"
        onClick={onSignOut}
        disabled={busy}
        className="btn-icon !h-6 !w-6 !rounded-[7px]"
        aria-label="Sign out"
      >
        {busy ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />}
      </button>
    </div>
  );
}
