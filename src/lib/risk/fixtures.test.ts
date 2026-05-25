import { describe, expect, it } from "vitest";

import {
  buildFixtureReport,
  fixtureCatalog,
  fixtureForInput,
} from "@/lib/risk/fixtures";

describe("fixtureCatalog", () => {
  it("exposes the three demo scenarios", () => {
    expect(fixtureCatalog()).toEqual([
      {
        key: "daycare",
        label: "Daycare",
        input: "Little Orchard Learning Studio, Oakland",
      },
      {
        key: "restaurant-delivery",
        label: "Restaurant + delivery",
        input: "Northline Tavern & Kitchen, Denver",
      },
      {
        key: "manufacturer",
        label: "Manufacturer",
        input: "Redline Fabrication Works, Akron",
      },
    ]);
  });
});

describe("fixtureForInput", () => {
  it("routes manufacturer-style prompts to the manufacturing scenario", () => {
    expect(fixtureForInput("Akron fabrication warehouse account")?.key).toBe(
      "manufacturer",
    );
  });
});

describe("buildFixtureReport", () => {
  it("returns a valid demo report with deterministic risk coverage", () => {
    const report = buildFixtureReport("manufacturer");

    expect(report.disclaimers).toContain(
      "Demo mode uses synthetic fixture evidence for the researched business.",
    );
    expect(report.riskSignals.map((signal) => signal.id)).toEqual(
      expect.arrayContaining([
        "property-equipment",
        "contracted-work",
        "staffing",
        "older-property-due-diligence",
      ]),
    );
    expect(
      report.coverageRecommendations.map((item) => item.coverage),
    ).toEqual(
      expect.arrayContaining([
        "Property/BPP",
        "Equipment Breakdown",
        "Inland Marine",
        "Workers Compensation",
      ]),
    );
    expect(report.trace.every((step) => step.status === "complete")).toBe(true);
  });
});
