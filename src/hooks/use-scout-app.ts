"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  type AuthStatus,
  type FeedItem,
  type Phase,
  type ResearchResponse,
  type ResultMeta,
  OPENAI_API_KEY_STORAGE_KEY,
  initialTimeline,
  packetText,
  previewFeedForInput,
  traceToTimeline,
} from "@/lib/app/scout-client";
import { exportRiskReportMarkdown } from "@/lib/risk/markdown-export";
import type { RiskReport } from "@/lib/risk/report-schema";
import { RESEARCH_STAGE_LABELS } from "@/lib/research/evidence";

function downloadText(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function useScoutApp() {
  const [phase, setPhase] = useState<Phase>("input");
  const [query, setQuery] = useState("");
  const [light, setLight] = useState(false);
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [openAIKey, setOpenAIKey] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.sessionStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) ?? "";
  });
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [resultMeta, setResultMeta] = useState<ResultMeta | null>(null);
  const [timeline, setTimeline] = useState(initialTimeline());
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const simulationRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    document.documentElement.classList.toggle("light", light);
  }, [light]);

  useEffect(() => {
    let mounted = true;

    fetch("/api/auth/codex/status", { cache: "no-store" })
      .then((response) =>
        response.ok ? (response.json() as Promise<AuthStatus>) : null,
      )
      .then((status) => {
        if (mounted && status) {
          setAuth(status);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) {
          setAuthLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        window.clearInterval(simulationRef.current);
      }
    };
  }, []);

  const signedInName = auth?.signedIn
    ? auth.profile?.name ??
      auth.profile?.email ??
      auth.profile?.accountId ??
      "Connected"
    : null;
  const signInAvailable = auth?.configuration?.signInAvailable ?? true;
  const signInProblemMessage = auth?.configuration?.message ?? null;
  const generation = auth?.generation;
  const generationProvider = generation?.provider ?? "codex";
  const generationRequiresSignIn = generation?.signInRequired ?? true;
  const generationRequiresApiKey = generation?.apiKeyRequired ?? false;
  const generationAvailable = generation?.available ?? false;
  const generationMessage = generation?.message ?? null;
  const hasOpenAIKey = openAIKey.trim().length > 0;

  const clearSimulation = useCallback(() => {
    if (simulationRef.current) {
      window.clearInterval(simulationRef.current);
      simulationRef.current = null;
    }
  }, []);

  const startSimulation = useCallback(
    (preview: FeedItem[]) => {
      clearSimulation();
      setTimeline(initialTimeline());
      setFeedItems(preview.slice(0, 1));

      let stageIndex = 0;
      let feedCount = 1;

      simulationRef.current = window.setInterval(() => {
        stageIndex = Math.min(stageIndex + 1, RESEARCH_STAGE_LABELS.length - 1);
        feedCount = Math.min(feedCount + 1, preview.length);
        setFeedItems(preview.slice(0, feedCount));
        setTimeline((current) =>
          current.map((stage, index) => ({
            ...stage,
            status:
              index < stageIndex
                ? "complete"
                : index === stageIndex
                  ? "active"
                  : "idle",
          })),
        );
      }, 850);
    },
    [clearSimulation],
  );

  const updateOpenAIKey = useCallback((value: string) => {
    setOpenAIKey(value);
    const trimmed = value.trim();

    if (trimmed) {
      window.sessionStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmed);
      return;
    }

    window.sessionStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
  }, []);

  const clearOpenAIKey = useCallback(() => {
    updateOpenAIKey("");
  }, [updateOpenAIKey]);

  const signOut = useCallback(async () => {
    setSigningOut(true);

    try {
      await fetch("/api/auth/codex/logout", {
        method: "POST",
      });
    } finally {
      setAuth((current) => ({
        signedIn: false,
        provider: "codex",
        configuration: current?.configuration,
        generation: current?.generation,
      }));
      setSigningOut(false);
      setReport(null);
      setResultMeta(null);
      setPhase("input");
      setError(null);
    }
  }, []);

  const resetRun = useCallback(() => {
    clearSimulation();
    setPhase("input");
    setReport(null);
    setResultMeta(null);
    setError(null);
    setTimeline(initialTimeline());
    setFeedItems([]);
    setCopied(false);
  }, [clearSimulation]);

  const runResearch = useCallback(
    async (inputValue: string, demoMode: boolean) => {
      const trimmed = inputValue.trim();
      if (trimmed.length < 3) {
        setError("Paste a website, Google Maps URL, or business name + city.");
        return;
      }

      if (!demoMode) {
        if (!generationAvailable) {
          setError(generationMessage ?? "Research provider is not configured.");
          return;
        }
        if (generationRequiresSignIn && !auth?.signedIn) {
          setError(
            signInProblemMessage ??
              "Sign in with Codex before running research.",
          );
          return;
        }
        if (generationRequiresApiKey && !hasOpenAIKey) {
          setError("Enter your OpenAI API key for this browser session.");
          return;
        }
      }

      startedAtRef.current = Date.now();
      setCopied(false);
      setIsBusy(true);
      setError(null);
      setPhase("research");
      setReport(null);
      setResultMeta(null);

      const preview = previewFeedForInput(trimmed, demoMode);
      startSimulation(preview);

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (!demoMode && generationRequiresApiKey) {
          headers["X-OpenAI-API-Key"] = openAIKey.trim();
        }

        const response = await fetch("/api/research-business", {
          method: "POST",
          headers,
          body: JSON.stringify({
            input: trimmed,
            demoMode,
          }),
        });

        if (response.status === 401) {
          setAuth((current) => ({
            signedIn: false,
            provider: "codex",
            configuration: current?.configuration,
            generation: current?.generation,
          }));
        }

        const data = (await response.json()) as Partial<ResearchResponse> & {
          error?: string;
        };

        if (!response.ok || !data.report || !data.source || !data.model) {
          throw new Error(data.error ?? "Research failed.");
        }

        clearSimulation();
        setTimeline(traceToTimeline(data.report.trace));
        setFeedItems(
          data.report.evidence.slice(0, 8).map((item) => ({
            title: item.title,
            snippet: item.snippet,
            sourceType: item.sourceType,
            confidence: item.confidence,
          })),
        );

        const minimumDelay = Math.max(
          0,
          2200 - (Date.now() - startedAtRef.current),
        );
        if (minimumDelay > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, minimumDelay));
        }

        setReport(data.report);
        setResultMeta({
          source: data.source,
          model: data.model,
        });
        setPhase("report");
      } catch (caught) {
        clearSimulation();
        setPhase("input");
        setError(caught instanceof Error ? caught.message : "Research failed.");
      } finally {
        setIsBusy(false);
      }
    },
    [
      auth?.signedIn,
      clearSimulation,
      generationAvailable,
      generationMessage,
      generationRequiresApiKey,
      generationRequiresSignIn,
      hasOpenAIKey,
      openAIKey,
      signInProblemMessage,
      startSimulation,
    ],
  );

  const copyPacket = useCallback(async () => {
    if (!report) return;
    await navigator.clipboard.writeText(packetText(report));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [report]);

  const exportMarkdown = useCallback(() => {
    if (!report) return;
    downloadText(
      "scout-report.md",
      exportRiskReportMarkdown(report),
      "text/markdown",
    );
  }, [report]);

  const exportJson = useCallback(() => {
    if (!report) return;
    downloadText(
      "scout-report.json",
      JSON.stringify(report, null, 2),
      "application/json",
    );
  }, [report]);

  return useMemo(
    () => ({
      phase,
      query,
      light,
      auth,
      authLoading,
      openAIKey,
      error,
      report,
      resultMeta,
      timeline,
      feedItems,
      isBusy,
      signingOut,
      copied,
      signedInName,
      signInAvailable,
      signInProblemMessage,
      generationProvider,
      generationRequiresSignIn,
      generationRequiresApiKey,
      generationAvailable,
      generationMessage,
      hasOpenAIKey,
      setQuery,
      setError,
      setLight,
      updateOpenAIKey,
      clearOpenAIKey,
      signOut,
      resetRun,
      runResearch,
      copyPacket,
      exportMarkdown,
      exportJson,
    }),
    [
      auth,
      authLoading,
      copied,
      error,
      exportJson,
      exportMarkdown,
      feedItems,
      generationAvailable,
      generationMessage,
      generationProvider,
      generationRequiresApiKey,
      generationRequiresSignIn,
      hasOpenAIKey,
      isBusy,
      light,
      openAIKey,
      phase,
      query,
      report,
      resetRun,
      resultMeta,
      runResearch,
      signInAvailable,
      signInProblemMessage,
      signOut,
      signingOut,
      signedInName,
      timeline,
      updateOpenAIKey,
      clearOpenAIKey,
      copyPacket,
    ],
  );
}
