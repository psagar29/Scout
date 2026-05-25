import { describe, expect, it } from "vitest";

import type {
  BusinessSnapshot,
  CoverageRecommendation,
  RiskSignal,
} from "@/lib/risk/report-schema";
import {
  buildBrokerCallPacket,
  buildCoverageRecommendations,
} from "@/lib/risk/coverage-map";

function snapshot(overrides: Partial<BusinessSnapshot> = {}): BusinessSnapshot {
  return {
    name: "Prospect Manufacturing",
    website: "https://prospect.example",
    address: "700 Mercer Avenue, Akron, OH 44311",
    phone: "(330) 555-0177",
    categories: ["manufacturer"],
    operatingSummary: "Light manufacturer with field service support.",
    locationsDetected: 1,
    employeeEstimate: "20-40 employees",
    ...overrides,
  };
}

function signal(overrides: Partial<RiskSignal> = {}): RiskSignal {
  return {
    id: "signal-id",
    label: "Customer foot traffic",
    category: "premises",
    severity: 3,
    confidence: "medium",
    whyItMatters: "Public traffic raises third-party injury exposure.",
    evidenceIds: ["ev-1"],
    coverageImplications: ["General Liability", "Umbrella"],
    ...overrides,
  };
}

function recommendation(
  overrides: Partial<CoverageRecommendation> = {},
): CoverageRecommendation {
  return {
    coverage: "General Liability",
    priority: "recommended",
    reason: "Baseline premises protection.",
    evidenceIds: ["ev-1"],
    askOnCall: ["What does daily customer traffic look like?"],
    missingData: ["Five-year GL loss runs"],
    ...overrides,
  };
}

describe("buildCoverageRecommendations", () => {
  it("merges duplicate coverages, preserves strongest priority, and deduplicates evidence", () => {
    const recommendations = buildCoverageRecommendations([
      signal(),
      signal({
        id: "food-product",
        label: "Food handling",
        category: "product",
        severity: 4,
        confidence: "high",
        whyItMatters: "Prepared food creates product exposure.",
        evidenceIds: ["ev-2", "ev-1"],
        coverageImplications: ["General Liability", "Product Liability"],
      }),
      signal({
        id: "cyber",
        label: "Customer data",
        category: "cyber",
        severity: 2,
        confidence: "medium",
        whyItMatters: "Stored payments create cyber questions.",
        evidenceIds: ["ev-3"],
        coverageImplications: ["Cyber Liability"],
      }),
    ]);

    expect(
      recommendations.map((item) => `${item.priority}:${item.coverage}`),
    ).toEqual([
      "required:General Liability",
      "required:Product Liability",
      "recommended:Umbrella",
      "consider:Cyber Liability",
    ]);

    expect(recommendations[0]).toMatchObject({
      coverage: "General Liability",
      priority: "required",
      evidenceIds: ["ev-1", "ev-2"],
      reason:
        "Triggered by Customer foot traffic and Food handling. Severity signal peak: 4/5.",
    });
  });
});

describe("buildBrokerCallPacket", () => {
  it("falls back to core underwriting questions when no signals were derived", () => {
    const packet = buildBrokerCallPacket({
      snapshot: snapshot({
        name: "Quiet Prospect",
        categories: [],
      }),
      signals: [],
      recommendations: [],
    });

    expect(packet.opener).toContain("commercial business account");
    expect(packet.questions).toEqual([
      "What are the main operations and revenue streams at Quiet Prospect?",
      "How many employees are on payroll, and what do they do day to day?",
      "Any owned vehicles, off-site work, events, or customer-facing activity we should account for?",
      "Does the public website accurately reflect current operations, services, and locations?",
    ]);
    expect(packet.underwriterNotes).toContain(
      "Initial coverage stack requires more operating detail.",
    );
  });

  it("uses top signals and recommendation prompts before falling back", () => {
    const packet = buildBrokerCallPacket({
      snapshot: snapshot(),
      signals: [
        signal({
          id: "auto",
          label: "Driving operations",
          category: "auto",
          severity: 4,
          confidence: "high",
          whyItMatters: "Delivery work expands vehicle liability exposure.",
          coverageImplications: [
            "Commercial Auto",
            "Hired and Non-Owned Auto",
          ],
        }),
      ],
      recommendations: [
        recommendation({
          coverage: "Commercial Auto",
          priority: "required",
          askOnCall: [
            "Are vehicles owned, leased, or financed by the business?",
            "What are the driver count, MVR standards, and radius of operation?",
          ],
          missingData: ["Vehicle schedule"],
        }),
      ],
    });

    expect(packet.questions[0]).toBe(
      "Confirm driving operations: Delivery work expands vehicle liability exposure.",
    );
    expect(packet.questions).toContain(
      "Are vehicles owned, leased, or financed by the business?",
    );
  });
});
