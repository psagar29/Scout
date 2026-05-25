import { Loader2, RotateCcw, Send } from "lucide-react";

import { ScoutMark } from "@/components/brand";
import { ReportView } from "@/components/report-view";
import { ResearchTimeline } from "@/components/research-timeline";
import type { FeedItem, ResultMeta, TimelineStage } from "@/lib/app/scout-client";
import type { RiskReport } from "@/lib/risk/report-schema";

export function WorkbenchStage({
  query,
  onQueryChange,
  onSubmit,
  onReset,
  isBusy,
  phase,
  timeline,
  feedItems,
  copied,
  report,
  resultMeta,
  onCopyPacket,
  onExportMarkdown,
  onExportJson,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  isBusy: boolean;
  phase: "research" | "report";
  timeline: TimelineStage[];
  feedItems: FeedItem[];
  copied: boolean;
  report: RiskReport | null;
  resultMeta: ResultMeta | null;
  onCopyPacket: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
}) {
  return (
    <div className="relative z-10 mx-auto max-w-7xl space-y-5 pt-14">
      <div className="topbar-glass mx-auto flex max-w-5xl items-center gap-2.5 px-3.5 py-2.5 anim-cascade">
        <ScoutMark size="sm" />
        <div
          className="mx-1 hidden h-5 w-px sm:block"
          style={{ background: "var(--border)" }}
        />
        <input
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
          className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--faint)]"
          style={{ color: "var(--fg)", caretColor: "var(--emerald)" }}
        />
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isBusy}
            className="btn-primary !h-8 !w-8 !p-0 !rounded-[10px]"
            aria-label="Run research"
          >
            {isBusy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="btn-icon !h-8 !w-8 !rounded-[10px]"
            aria-label="Reset"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {phase === "research" ? (
        <ResearchTimeline input={query} stages={timeline} feedItems={feedItems} />
      ) : report && resultMeta ? (
        <>
          {copied ? (
            <div
              className="glass-inner mx-auto max-w-fit px-4 py-2 text-[11px] font-semibold anim-fade"
              style={{ color: "rgb(110 231 183)" }}
            >
              Broker packet copied to clipboard
            </div>
          ) : null}
          <ReportView
            report={report}
            source={resultMeta.source}
            model={resultMeta.model}
            onCopyPacket={onCopyPacket}
            onExportMarkdown={onExportMarkdown}
            onExportJson={onExportJson}
            onReset={onReset}
          />
        </>
      ) : null}
    </div>
  );
}
