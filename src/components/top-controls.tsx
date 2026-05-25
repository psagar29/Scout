import { AuthChip, GitHubChip, ProviderChip, ThemeToggle } from "@/components/chips";

export function TopControls({
  light,
  onToggleTheme,
  authLoading,
  signedIn,
  signedInName,
  signInAvailable,
  onSignOut,
  signingOut,
  provider,
  providerAvailable,
}: {
  light: boolean;
  onToggleTheme: () => void;
  authLoading: boolean;
  signedIn: boolean;
  signedInName: string | null;
  signInAvailable: boolean;
  onSignOut: () => void;
  signingOut: boolean;
  provider: "codex" | "openai";
  providerAvailable: boolean;
}) {
  return (
    <div className="fixed right-4 top-4 z-30 flex max-w-[calc(100vw-32px)] flex-wrap items-center justify-end gap-2 sm:right-6 sm:top-6">
      <GitHubChip />
      <AuthChip
        loading={authLoading}
        signedIn={signedIn}
        name={signedInName}
        signInAvailable={signInAvailable}
        onSignOut={onSignOut}
        busy={signingOut}
      />
      <ProviderChip provider={provider} available={providerAvailable} />
      <ThemeToggle light={light} onToggle={onToggleTheme} />
    </div>
  );
}
