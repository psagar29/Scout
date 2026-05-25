"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { FeedItem, TimelineStage } from "@/lib/app/scout-client";

function confidenceColor(confidence: FeedItem["confidence"]) {
  if (confidence === "high") return "rgb(16 185 129)";
  if (confidence === "medium") return "rgb(245 158 11)";
  return "rgb(239 68 68)";
}

function DotIcon({ status }: { status: TimelineStage["status"] }) {
  if (status === "complete") return <CheckCircle2 size={11} style={{ color: "#fff" }} />;
  if (status === "warning" || status === "error") return <AlertTriangle size={11} style={{ color: "#fff" }} />;
  if (status === "active") return <Loader2 size={11} className="animate-spin" style={{ color: "var(--emerald)" }} />;
  return null;
}

function ElapsedTimer() {
  const start = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    start.current = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start.current), 100);
    return () => clearInterval(id);
  }, []);

  const seconds = (elapsed / 1000).toFixed(1);
  return (
    <span className="tabular-nums" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>
      {seconds}s
    </span>
  );
}

export function ResearchTimeline({
  input,
  stages,
  feedItems,
}: {
  input: string;
  stages: TimelineStage[];
  feedItems: FeedItem[];
}) {
  const completedCount = useMemo(
    () => stages.filter((s) => s.status === "complete" || s.status === "warning").length,
    [stages],
  );
  const fillPercent = stages.length > 0 ? (completedCount / stages.length) * 100 : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Left — timeline */}
      <div className="glass p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <span className="label-caps mb-1.5 block">Research run</span>
            <div className="text-[14px] font-medium leading-relaxed" style={{ color: "var(--fg)" }}>
              {input}
            </div>
          </div>
          <div
            className="flex h-9 items-center gap-2 rounded-[10px] px-3 text-[12px] font-semibold"
            style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--border)", color: "var(--emerald)" }}
          >
            <Loader2 size={12} className="animate-spin" />
            <ElapsedTimer />
          </div>
        </div>

        {/* progress bar */}
        <div
          className="mb-6 h-1 overflow-hidden rounded-full"
          style={{ background: "var(--btn-secondary-bg)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${fillPercent}%`,
              background: "linear-gradient(90deg, var(--emerald), rgba(16,185,129,0.5))",
              transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>

        {/* stages with connected line */}
        <div className="relative">
          {/* vertical connector line */}
          <div className="timeline-line">
            <div
              className="timeline-line-fill"
              style={{ height: `${fillPercent}%` }}
            />
          </div>

          <div className="space-y-1">
            {stages.map((stage, index) => (
              <div
                key={stage.label}
                className="timeline-node stagger-item py-2.5"
                style={{ "--i": index } as React.CSSProperties}
              >
                {/* dot */}
                <div
                  className={`timeline-dot ${
                    stage.status === "complete"
                      ? "dot-complete"
                      : stage.status === "active"
                        ? "dot-active"
                        : stage.status === "warning" || stage.status === "error"
                          ? "dot-warning"
                          : "dot-idle"
                  }`}
                >
                  <DotIcon status={stage.status} />
                </div>

                {/* content */}
                <div>
                  <div
                    className="text-[13px] font-semibold"
                    style={{
                      color: stage.status === "idle" ? "var(--faint)" : "var(--fg)",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {stage.label}
                  </div>
                  <div
                    className="mt-0.5 text-[11px] leading-relaxed"
                    style={{
                      color: stage.status === "idle" ? "var(--subtle)" : "var(--muted)",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {stage.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — source feed */}
      <div className="glass p-5 sm:p-6 scan-line">
        <div className="mb-5">
          <span className="label-caps mb-1.5 block">Source feed</span>
          <div className="text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
            Evidence collected from public sources as Scout works.
          </div>
        </div>
        <div className="space-y-2.5">
          {feedItems.length === 0 ? (
            <div className="space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-[72px] w-full rounded-[14px]" />
              ))}
            </div>
          ) : (
            feedItems.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="glass-inner card-hover px-4 py-3 stagger-item"
                style={{ "--i": index } as React.CSSProperties}
              >
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="indicator-dot"
                      style={{ background: confidenceColor(item.confidence) }}
                    />
                    <span className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>
                      {item.title}
                    </span>
                  </div>
                  <span
                    className="tag"
                    style={{
                      background: "var(--btn-secondary-bg)",
                      border: "1px solid var(--border)",
                      color: "var(--faint)",
                      fontSize: "10px",
                    }}
                  >
                    {item.sourceType}
                  </span>
                </div>
                <div className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  {item.snippet}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
