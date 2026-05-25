import { describe, expect, it } from "vitest";

import {
  buildFixtureReport,
} from "@/lib/risk/fixtures";
import {
  riskReportSchema,
  type RiskReport,
} from "@/lib/risk/report-schema";

function cloneReport(report: RiskReport): RiskReport {
  return structuredClone(report);
}

describe("riskReportSchema", () => {
  it("accepts a fully grounded fixture report", () => {
    const report = buildFixtureReport("daycare");

    expect(riskReportSchema.parse(report)).toEqual(report);
  });

  it("rejects risk signals that reference unknown evidence ids", () => {
    const report = cloneReport(buildFixtureReport("daycare"));
    report.riskSignals[0] = {
      ...report.riskSignals[0],
      evidenceIds: ["missing-evidence"],
    };

    const parsed = riskReportSchema.safeParse(report);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: "Unknown evidence ID: missing-evidence",
        }),
      ]),
    );
  });

  it("allows low-confidence model-inference risk signals without evidence ids", () => {
    const report = cloneReport(buildFixtureReport("daycare"));
    report.evidence.push({
      id: "model-1",
      sourceType: "model_inference",
      title: "Low-confidence inference",
      snippet: "Only sparse public data was available for this account.",
      fetchedAt: "2026-05-25T18:00:00.000Z",
      confidence: "low",
    });
    report.riskSignals.push({
      id: "possible-cyber",
      label: "Possible cyber exposure",
      category: "cyber",
      severity: 1,
      confidence: "low",
      whyItMatters: "Online booking may exist, but current evidence is incomplete.",
      evidenceIds: [],
      coverageImplications: ["Cyber Liability"],
    });

    expect(riskReportSchema.safeParse(report).success).toBe(true);
  });

  it("rejects coverage recommendations without evidence ids when no inference evidence exists", () => {
    const report = cloneReport(buildFixtureReport("daycare"));
    report.coverageRecommendations[0] = {
      ...report.coverageRecommendations[0],
      evidenceIds: [],
    };

    const parsed = riskReportSchema.safeParse(report);

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message:
            "Coverage recommendations need evidenceIds unless they rely on model inference evidence.",
        }),
      ]),
    );
  });
});
