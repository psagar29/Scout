import { describe, expect, it } from "vitest";

import type { BusinessSnapshot, EvidenceItem } from "@/lib/risk/report-schema";
import { deriveDeterministicRiskSignals } from "@/lib/risk/risk-rules";

function baseSnapshot(overrides: Partial<BusinessSnapshot> = {}): BusinessSnapshot {
  return {
    name: "Northline Tavern & Kitchen",
    website: "https://northline.example",
    address: "4128 Blake Street, Denver, CO 80216",
    phone: "(303) 555-0128",
    categories: ["restaurant", "bar", "delivery"],
    operatingSummary:
      "Neighborhood tavern with dine-in food service, alcohol sales, and delivery operations.",
    locationsDetected: 1,
    employeeEstimate: "15-30 employees",
    ...overrides,
  };
}

function evidence(
  id: string,
  title: string,
  snippet: string,
  confidence: EvidenceItem["confidence"] = "high",
): EvidenceItem {
  return {
    id,
    sourceType: "website",
    title,
    snippet,
    fetchedAt: "2026-05-25T18:00:00.000Z",
    confidence,
  };
}

describe("deriveDeterministicRiskSignals", () => {
  it("maps keyword evidence into grounded operating signals", () => {
    const signals = deriveDeterministicRiskSignals({
      snapshot: baseSnapshot(),
      evidence: [
        evidence(
          "ev-1",
          "Menu and services",
          "Beer, wine, cocktails, food, and catering are available for daily service.",
        ),
        evidence(
          "ev-2",
          "Delivery note",
          "Drivers use a company van for customer pickup and delivery orders.",
        ),
        evidence(
          "ev-3",
          "Team page",
          "Meet the staff team handling front-of-house service and kitchen prep.",
          "medium",
        ),
      ],
      flood: null,
      property: null,
    });

    expect(signals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining([
        "auto-operations",
        "liquor",
        "food-product",
        "staffing",
      ]),
    );

    expect(signals[0].severity).toBeGreaterThanOrEqual(
      signals[signals.length - 1].severity,
    );

    const autoSignal = signals.find((signal) => signal.id === "auto-operations");
    expect(autoSignal).toMatchObject({
      category: "auto",
      confidence: "high",
      coverageImplications: [
        "Commercial Auto",
        "Hired and Non-Owned Auto",
      ],
    });
    expect(autoSignal?.evidenceIds).toEqual(["ev-1", "ev-2"]);
  });

  it("adds a FEMA flood signal when the location is in a mapped hazard area", () => {
    const signals = deriveDeterministicRiskSignals({
      snapshot: baseSnapshot({
        categories: ["retail"],
        operatingSummary: "Single-location retail shop.",
      }),
      evidence: [],
      flood: {
        zone: "AE",
        subType: "1 PCT ANNUAL CHANCE FLOOD HAZARD",
        isSpecialFloodHazardArea: true,
        evidenceId: "fema-1",
      },
      property: null,
    });

    expect(signals).toContainEqual(
      expect.objectContaining({
        id: "fema-flood-zone",
        category: "catastrophe",
        severity: 4,
        confidence: "high",
        evidenceIds: ["fema-1"],
        coverageImplications: ["Flood", "Business Income"],
      }),
    );
  });

  it("flags older or unverified properties with cautious due-diligence language", () => {
    const signals = deriveDeterministicRiskSignals({
      snapshot: baseSnapshot({
        name: "Redline Fabrication Works",
        categories: ["light manufacturing", "warehouse"],
        operatingSummary: "Light manufacturer in an older industrial building.",
      }),
      evidence: [],
      flood: null,
      property: {
        buildingYear: null,
        olderPropertyUnknown: true,
        evidenceId: "prop-1",
      },
    });

    const propertySignal = signals.find(
      (signal) => signal.id === "older-property-due-diligence",
    );

    expect(propertySignal).toMatchObject({
      category: "environmental",
      severity: 3,
      confidence: "low",
      evidenceIds: ["prop-1"],
      coverageImplications: ["Property/BPP", "Business Income"],
    });
    expect(propertySignal?.whyItMatters).toContain(
      "Treat potential asbestos/PACM as a due diligence flag, not a confirmed condition.",
    );
  });
});
