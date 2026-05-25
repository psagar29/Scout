"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardCopy,
  Download,
  FileText,
  MessageSquare,
  RotateCcw,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";

import { type RiskReport } from "@/lib/risk/report-schema";
import { confidenceSummary } from "@/lib/research/evidence";

type ReportTab = "risks" | "coverage" | "evidence" | "packet";

function confidenceTone(value: "low" | "medium" | "high") {
  if (value === "high") return { bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.16)", text: "rgb(110 231 183)", dot: "dot-high" };
  if (value === "medium") return { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.14)", text: "rgb(253 224 71)", dot: "dot-medium" };
  return { bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.14)", text: "rgb(252 165 165)", dot: "dot-low" };
}

function priorityTone(priority: "required" | "recommended" | "consider") {
  if (priority === "required") return { bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.14)", text: "rgb(252 165 165)", label: "Required" };
  if (priority === "recommended") return { bg: "rgba(16,185,129,0.07)", border: "rgba(16,185,129,0.14)", text: "rgb(110 231 183)", label: "Recommended" };
  return { bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.14)", text: "rgb(253 224 71)", label: "Consider" };
}

function SeverityBar({ level }: { level: number }) {
  return (
    <div className="severity-bar">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`sev-segment ${
            i < level
              ? `filled ${level >= 4 ? "sev-high" : level === 3 ? "sev-med" : "sev-low"}`
              : ""
          }`}
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="glass-inner px-4 py-3.5">
      <div className="label-caps mb-1">{label}</div>
      <div className="text-[22px] font-semibold tabular-nums anim-fade" style={{ color: "var(--fg)" }}>
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>
      )}
    </div>
  );
}

function sourceForId(report: RiskReport, id: string) {
  return report.evidence.find((item) => item.id === id);
}

export function ReportView({
  report,
  source,
  model,
  onCopyPacket,
  onExportMarkdown,
  onExportJson,
  onReset,
}: {
  report: RiskReport;
  source: "codex" | "openai" | "fixture";
  model: string;
  onCopyPacket: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onReset: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ReportTab>("risks");
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());

  const confidence = confidenceSummary(report.evidence);
  const confidenceUi = confidenceTone(confidence);
  const requiredCount = report.coverageRecommendations.filter((c) => c.priority === "required").length;
  const maxSeverity = Math.max(...report.riskSignals.map((s) => s.severity), 0);

  function toggleSignal(id: string) {
    setExpandedSignals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tabs: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
    { key: "risks", label: "Risk Signals", icon: <ShieldAlert size={13} /> },
    { key: "coverage", label: "Coverage", icon: <Shield size={13} /> },
    { key: "evidence", label: "Evidence", icon: <FileText size={13} /> },
    { key: "packet", label: "Call Packet", icon: <MessageSquare size={13} /> },
  ];

  return (
    <div className="space-y-5 anim-up">
      {/* ── Header card ── */}
      <div className="glass p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="label-caps">Broker packet</span>
              <span
                className="tag"
                style={{ background: confidenceUi.bg, border: `1px solid ${confidenceUi.border}`, color: confidenceUi.text }}
              >
                <span className={`indicator-dot ${confidenceUi.dot}`} />
                {confidence} confidence
              </span>
            </div>
            <h1
              className="text-[28px] font-semibold tracking-tight sm:text-[36px]"
              style={{ color: "var(--fg)" }}
            >
              {report.snapshot.name}
            </h1>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
              {report.snapshot.operatingSummary}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {report.snapshot.categories.slice(0, 4).map((cat) => (
                <span
                  key={cat}
                  className="tag"
                  style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--border)", color: "var(--fg-secondary)", fontSize: "10px" }}
                >
                  {cat}
                </span>
              ))}
              <span className="tag" style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--border)", color: "var(--faint)", fontSize: "10px" }}>
                {source === "fixture" ? "demo" : source} · {model}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button type="button" onClick={onCopyPacket} className="btn-primary">
              <ClipboardCopy size={13} />
              Copy packet
            </button>
            <button type="button" onClick={onExportMarkdown} className="btn-secondary">
              <Download size={13} />
              Markdown
            </button>
            <button type="button" onClick={onExportJson} className="btn-secondary">
              <Download size={13} />
              JSON
            </button>
            <button type="button" onClick={onReset} className="btn-secondary">
              <RotateCcw size={13} />
              New search
            </button>
          </div>
        </div>

        {/* stat row */}
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <StatCard label="Risk signals" value={report.riskSignals.length} sub={`Max severity: ${maxSeverity}/5`} />
          <StatCard label="Coverage items" value={report.coverageRecommendations.length} sub={`${requiredCount} required`} />
          <StatCard label="Evidence items" value={report.evidence.length} sub={`${confidence} overall confidence`} />
          <StatCard
            label="Business info"
            value={report.snapshot.locationsDetected ?? "—"}
            sub={report.snapshot.employeeEstimate ? `~${report.snapshot.employeeEstimate} employees` : "Employee count unknown"}
          />
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div className="tab-nav">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`tab-btn ${activeTab === tab.key ? "tab-active" : ""}`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="anim-fade" key={activeTab}>
        {activeTab === "risks" && (
          <div className="space-y-3">
            {report.riskSignals.map((signal, i) => {
              const isExpanded = expandedSignals.has(signal.id);
              return (
                <div
                  key={signal.id}
                  className="glass card-hover p-4 sm:p-5 stagger-item"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                          {signal.label}
                        </span>
                        <span
                          className="tag"
                          style={{
                            background: confidenceTone(signal.confidence).bg,
                            border: `1px solid ${confidenceTone(signal.confidence).border}`,
                            color: confidenceTone(signal.confidence).text,
                            fontSize: "10px",
                          }}
                        >
                          {signal.confidence}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[11px]" style={{ color: "var(--faint)" }}>
                        <span className="capitalize">{signal.category}</span>
                        <span style={{ opacity: 0.4 }}>·</span>
                        <span>{signal.evidenceIds.length} source{signal.evidenceIds.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <SeverityBar level={signal.severity} />
                  </div>

                  <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                    {signal.whyItMatters}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {signal.coverageImplications.map((cov) => (
                      <span
                        key={cov}
                        className="tag"
                        style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--border)", color: "var(--fg-secondary)", fontSize: "10px" }}
                      >
                        {cov}
                      </span>
                    ))}
                  </div>

                  {/* expandable evidence */}
                  <button
                    type="button"
                    onClick={() => toggleSignal(signal.id)}
                    className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold transition-colors duration-200"
                    style={{ color: "var(--muted)" }}
                  >
                    <ChevronDown
                      size={12}
                      style={{
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0)",
                        transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    />
                    {isExpanded ? "Hide" : "View"} source evidence
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 anim-fade">
                      {signal.evidenceIds.map((eid) => {
                        const ev = sourceForId(report, eid);
                        if (!ev) return null;
                        return (
                          <div
                            key={eid}
                            className="rounded-[12px] px-3.5 py-3"
                            style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--border)" }}
                          >
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-[11px] font-semibold" style={{ color: "var(--fg)" }}>
                                {ev.title}
                              </span>
                              <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--faint)" }}>
                                {ev.sourceType}
                              </span>
                            </div>
                            <div className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                              {ev.snippet}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "coverage" && (
          <div className="grid gap-3 md:grid-cols-2">
            {report.coverageRecommendations.map((rec, i) => {
              const tone = priorityTone(rec.priority);
              return (
                <div
                  key={rec.coverage}
                  className="glass card-hover p-4 sm:p-5 stagger-item"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                      {rec.coverage}
                    </span>
                    <span
                      className="tag"
                      style={{
                        background: tone.bg,
                        border: `1px solid ${tone.border}`,
                        color: tone.text,
                        fontSize: "10px",
                      }}
                    >
                      {tone.label}
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                    {rec.reason}
                  </p>

                  {rec.askOnCall.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--fg)" }}>
                        <MessageSquare size={11} />
                        Ask on call
                      </div>
                      <ul className="space-y-1">
                        {rec.askOnCall.map((q) => (
                          <li key={q} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--faint)" }} />
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rec.missingData.length > 0 && (
                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "var(--amber)" }}>
                        <AlertTriangle size={11} />
                        Missing data
                      </div>
                      <ul className="space-y-1">
                        {rec.missingData.map((d) => (
                          <li key={d} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--amber)" }} />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "evidence" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.evidence.map((item, i) => {
              const tone = confidenceTone(item.confidence);
              return (
                <div
                  key={item.id}
                  className="glass card-hover p-4 stagger-item"
                  style={{ "--i": i } as React.CSSProperties}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold" style={{ color: "var(--fg)" }}>
                        {item.title}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--faint)" }}>
                        {item.sourceType}
                      </div>
                    </div>
                    <span
                      className="tag shrink-0"
                      style={{
                        background: tone.bg,
                        border: `1px solid ${tone.border}`,
                        color: tone.text,
                        fontSize: "10px",
                      }}
                    >
                      {item.confidence}
                    </span>
                  </div>
                  <div className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                    {item.snippet}
                  </div>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-[10px] font-medium truncate max-w-full"
                      style={{ color: "var(--emerald-dim)" }}
                    >
                      {item.url}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "packet" && (
          <div className="space-y-4">
            {/* Opener */}
            <div className="glass p-5 gradient-border" style={{ borderRadius: 20 }}>
              <div className="mb-2 label-caps">Opening line</div>
              <p className="text-[14px] leading-relaxed font-medium" style={{ color: "var(--fg)" }}>
                {report.brokerCallPacket.opener}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Questions */}
              <div className="glass p-5">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle2 size={14} style={{ color: "var(--emerald)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                    Questions to ask
                  </span>
                </div>
                <ul className="space-y-2">
                  {report.brokerCallPacket.questions.map((q, i) => (
                    <li
                      key={q}
                      className="flex items-start gap-2.5 text-[12px] leading-relaxed stagger-item"
                      style={{ color: "var(--fg-secondary)", "--i": i } as React.CSSProperties}
                    >
                      <span
                        className="mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] text-[9px] font-bold"
                        style={{ background: "var(--btn-secondary-bg)", border: "1px solid var(--border)", color: "var(--muted)" }}
                      >
                        {i + 1}
                      </span>
                      {q}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Underwriter notes */}
              <div className="glass p-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} style={{ color: "var(--amber)" }} />
                  <span className="text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                    Underwriter notes
                  </span>
                </div>
                <ul className="space-y-2">
                  {report.brokerCallPacket.underwriterNotes.map((note, i) => (
                    <li
                      key={note}
                      className="flex items-start gap-2 text-[12px] leading-relaxed stagger-item"
                      style={{ color: "var(--fg-secondary)", "--i": i } as React.CSSProperties}
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--amber)" }} />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Objections */}
              <div className="glass p-5">
                <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                  Likely objections
                </div>
                <div className="space-y-2.5">
                  {report.brokerCallPacket.likelyObjections.map((obj, i) => (
                    <div
                      key={obj.objection}
                      className="glass-inner px-3.5 py-3 stagger-item"
                      style={{ "--i": i } as React.CSSProperties}
                    >
                      <div className="text-[11px] font-semibold" style={{ color: "var(--fg)" }}>
                        &ldquo;{obj.objection}&rdquo;
                      </div>
                      <div className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
                        {obj.response}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Follow-up */}
              <div className="glass p-5">
                <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                  Follow-up documents
                </div>
                <ul className="space-y-2">
                  {report.brokerCallPacket.followUpDocuments.map((doc, i) => (
                    <li
                      key={doc}
                      className="flex items-start gap-2.5 text-[12px] leading-relaxed stagger-item"
                      style={{ color: "var(--fg-secondary)", "--i": i } as React.CSSProperties}
                    >
                      <FileText size={12} className="mt-0.5 shrink-0" style={{ color: "var(--faint)" }} />
                      {doc}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Disclaimers ── */}
      <div className="glass-inner px-5 py-4">
        <div className="label-caps mb-2">Disclaimers</div>
        <div className="space-y-1">
          {report.disclaimers.map((d) => (
            <div key={d} className="flex items-start gap-2 text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--faint)" }} />
              {d}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
