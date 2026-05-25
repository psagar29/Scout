"use client";

import { useEffect, useRef } from "react";

import { AuthGate } from "@/components/auth-gate";
import { InputStage } from "@/components/input-stage";
import { TopControls } from "@/components/top-controls";
import { WorkbenchStage } from "@/components/workbench-stage";
import { EXAMPLES, FIXTURES } from "@/lib/app/scout-client";
import { useScoutApp } from "@/hooks/use-scout-app";

export default function Home() {
  const app = useScoutApp();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (app.phase === "input") {
      inputRef.current?.focus();
    }
  }, [app.phase]);

  function handleQueryChange(value: string) {
    app.setQuery(value);
    if (app.error) {
      app.setError(null);
    }
  }

  const providerAvailable =
    app.generationAvailable &&
    (!app.generationRequiresApiKey || app.hasOpenAIKey);
  const toggleTheme = () => app.setLight((value) => !value);
  const runFixture = (input: string) => {
    app.setQuery(input);
    void app.runResearch(input, true);
  };

  if (app.authLoading && app.phase === "input") {
    return (
      <>
        <TopControls
          light={app.light}
          onToggleTheme={toggleTheme}
          authLoading
          signedIn={false}
          signedInName={null}
          signInAvailable={app.signInAvailable}
          onSignOut={app.signOut}
          signingOut={false}
          provider={app.generationProvider}
          providerAvailable={app.generationAvailable}
        />
        <AuthGate
          loading
          title="Scout"
          message="Checking this browser and provider configuration..."
          signInAvailable={app.signInAvailable}
          signInProblemMessage={null}
          fixtures={FIXTURES}
          onSelectFixture={(choice) => {
            runFixture(choice.input);
          }}
        />
      </>
    );
  }

  if (app.phase === "input" && app.generationRequiresSignIn && !app.auth?.signedIn) {
    return (
      <>
        <TopControls
          light={app.light}
          onToggleTheme={toggleTheme}
          authLoading={false}
          signedIn={false}
          signedInName={null}
          signInAvailable={app.signInAvailable}
          onSignOut={app.signOut}
          signingOut={app.signingOut}
          provider={app.generationProvider}
          providerAvailable={app.generationAvailable}
        />
        <AuthGate
          title="Scout"
          message="Autonomous pre-call research for commercial insurance brokers."
          signInAvailable={app.signInAvailable}
          signInProblemMessage={app.signInProblemMessage}
          fixtures={FIXTURES}
          onSelectFixture={(choice) => {
            runFixture(choice.input);
          }}
        />
      </>
    );
  }

  if (app.phase === "input" && app.generationRequiresApiKey && !app.hasOpenAIKey) {
    return (
      <>
        <TopControls
          light={app.light}
          onToggleTheme={toggleTheme}
          authLoading={false}
          signedIn={Boolean(app.auth?.signedIn)}
          signedInName={app.signedInName}
          signInAvailable={app.signInAvailable}
          onSignOut={app.signOut}
          signingOut={app.signingOut}
          provider={app.generationProvider}
          providerAvailable={providerAvailable}
        />
        <AuthGate
          title="Scout"
          message="Enter your OpenAI API key or try a demo fixture."
          signInAvailable={false}
          signInProblemMessage={null}
          apiKeyMode
          apiKeyValue={app.openAIKey}
          onApiKeyChange={app.updateOpenAIKey}
          onApiKeyClear={app.clearOpenAIKey}
          fixtures={FIXTURES}
          onSelectFixture={(choice) => {
            runFixture(choice.input);
          }}
        />
      </>
    );
  }

  return (
    <main className="relative min-h-screen px-4 pb-16 pt-5 sm:px-6">
      <div
        className="ambient anim-breathe"
        style={{
          width: 650,
          height: 650,
          top: "0%",
          left: "5%",
          background: "var(--glow-1)",
        }}
      />
      <div
        className="ambient anim-breathe"
        style={{
          width: 500,
          height: 500,
          bottom: "5%",
          right: "3%",
          background: "var(--glow-2)",
          animationDelay: "-5s",
        }}
      />
      <div
        className="ambient anim-breathe"
        style={{
          width: 400,
          height: 400,
          top: "40%",
          left: "50%",
          background: "var(--glow-3)",
          animationDelay: "-8s",
        }}
      />

      <TopControls
        light={app.light}
        onToggleTheme={toggleTheme}
        authLoading={app.authLoading}
        signedIn={Boolean(app.auth?.signedIn)}
        signedInName={app.signedInName}
        signInAvailable={app.signInAvailable}
        onSignOut={app.signOut}
        signingOut={app.signingOut}
        provider={app.generationProvider}
        providerAvailable={providerAvailable}
      />

      {app.phase === "input" ? (
        <InputStage
          inputRef={inputRef}
          query={app.query}
          onQueryChange={handleQueryChange}
          onSubmit={() => void app.runResearch(app.query, false)}
          isBusy={app.isBusy}
          generationRequiresApiKey={app.generationRequiresApiKey}
          openAIKey={app.openAIKey}
          onOpenAIKeyChange={app.updateOpenAIKey}
          onOpenAIKeyClear={app.clearOpenAIKey}
          examples={EXAMPLES}
          fixtures={FIXTURES}
          error={app.error}
          generationAvailable={app.generationAvailable}
          generationMessage={app.generationMessage}
          onSelectFixture={(choice) => runFixture(choice.input)}
        />
      ) : (
        <WorkbenchStage
          query={app.query}
          onQueryChange={app.setQuery}
          onSubmit={() => void app.runResearch(app.query, false)}
          onReset={app.resetRun}
          isBusy={app.isBusy}
          phase={app.phase}
          timeline={app.timeline}
          feedItems={app.feedItems}
          copied={app.copied}
          report={app.report}
          resultMeta={app.resultMeta}
          onCopyPacket={() => void app.copyPacket()}
          onExportMarkdown={app.exportMarkdown}
          onExportJson={app.exportJson}
        />
      )}
    </main>
  );
}
