import { describe, expect, it } from "vitest";

import type { EvidenceItem } from "@/lib/risk/report-schema";
import {
  confidenceSummary,
  createEvidenceItem,
  sortEvidenceByConfidence,
  uniqueEvidenceIds,
} from "@/lib/research/evidence";

function evidenceItem(
  id: string,
  title: string,
  confidence: EvidenceItem["confidence"],
): EvidenceItem {
  return {
    id,
    sourceType: "website",
    title,
    snippet: `${title} snippet`,
    fetchedAt: "2026-05-25T18:00:00.000Z",
    confidence,
  };
}

describe("createEvidenceItem", () => {
  it("trims content and uses a slugged id prefix", () => {
    const item = createEvidenceItem({
      sourceType: "website",
      title: "  Main Services  ",
      snippet: "  Delivery and catering for office lunches.  ",
      confidence: "high",
      fetchedAt: "2026-05-25T18:00:00.000Z",
      idHint: "Northline Tavern",
      url: "https://northline.example/services",
    });

    expect(item).toMatchObject({
      sourceType: "website",
      title: "Main Services",
      snippet: "Delivery and catering for office lunches.",
      fetchedAt: "2026-05-25T18:00:00.000Z",
      url: "https://northline.example/services",
      confidence: "high",
    });
    expect(item.id).toMatch(/^northline-tavern-[a-z0-9]{8}$/u);
  });
});

describe("uniqueEvidenceIds", () => {
  it("deduplicates ids and drops empty values", () => {
    expect(uniqueEvidenceIds(["ev-1", "", "ev-2", "ev-1", "ev-2"])).toEqual([
      "ev-1",
      "ev-2",
    ]);
  });
});

describe("sortEvidenceByConfidence", () => {
  it("sorts by confidence first, then title", () => {
    const sorted = sortEvidenceByConfidence([
      evidenceItem("medium-zulu", "Zulu", "medium"),
      evidenceItem("low-bravo", "Bravo", "low"),
      evidenceItem("high-charlie", "Charlie", "high"),
      evidenceItem("high-alpha", "Alpha", "high"),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "high-alpha",
      "high-charlie",
      "medium-zulu",
      "low-bravo",
    ]);
  });
});

describe("confidenceSummary", () => {
  it("returns the expected band for weighted evidence confidence", () => {
    expect(confidenceSummary([evidenceItem("h1", "Alpha", "high")])).toBe("high");
    expect(
      confidenceSummary([
        evidenceItem("m1", "Alpha", "medium"),
        evidenceItem("m2", "Bravo", "medium"),
        evidenceItem("l1", "Charlie", "low"),
      ]),
    ).toBe("medium");
    expect(confidenceSummary([evidenceItem("l2", "Delta", "low")])).toBe("low");
  });
});
