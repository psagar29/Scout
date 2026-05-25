import {
  type RiskReport,
  riskReportSchema,
  type BusinessSnapshot,
} from "@/lib/risk/report-schema";
import {
  buildBrokerCallPacket,
  buildCoverageRecommendations,
} from "@/lib/risk/coverage-map";
import { deriveDeterministicRiskSignals } from "@/lib/risk/risk-rules";
import {
  RESEARCH_STAGE_LABELS,
  confidenceSummary,
  createEvidenceItem,
  createTraceStep,
} from "@/lib/research/evidence";

type FixtureKey = "daycare" | "restaurant-delivery" | "manufacturer";

type FixtureScenario = {
  key: FixtureKey;
  label: string;
  exampleInput: string;
  snapshot: BusinessSnapshot;
  evidence: ReturnType<typeof createEvidenceItem>[];
  flood: {
    zone: string | null;
    subType: string | null;
    isSpecialFloodHazardArea: boolean;
    evidenceId?: string;
  } | null;
  property: {
    buildingYear: number | null;
    olderPropertyUnknown: boolean;
    evidenceId?: string;
  } | null;
};

function fixtureTimestamp() {
  return new Date().toISOString();
}

function buildScenarioReports(scenario: FixtureScenario, input?: string): RiskReport {
  const riskSignals = deriveDeterministicRiskSignals({
    snapshot: scenario.snapshot,
    evidence: scenario.evidence,
    flood: scenario.flood,
    property: scenario.property,
  });
  const coverageRecommendations = buildCoverageRecommendations(riskSignals);
  const brokerCallPacket = buildBrokerCallPacket({
    snapshot: scenario.snapshot,
    signals: riskSignals,
    recommendations: coverageRecommendations,
  });

  const evidenceIds = scenario.evidence.map((item) => item.id);
  const trace = RESEARCH_STAGE_LABELS.map((label, index) =>
    createTraceStep({
      id: `fixture-stage-${index + 1}`,
      label,
      status: "complete",
      detail:
        index === 0
          ? "Demo fixture selected."
          : index === RESEARCH_STAGE_LABELS.length - 1
            ? "Broker packet assembled from deterministic rules."
            : "Demo evidence loaded for this stage.",
      evidenceIds,
    }),
  );

  const report = {
    id: `fixture-${scenario.key}`,
    createdAt: fixtureTimestamp(),
    input: input?.trim() || scenario.exampleInput,
    snapshot: {
      ...scenario.snapshot,
      operatingSummary: `${scenario.snapshot.operatingSummary} Confidence: ${confidenceSummary(scenario.evidence)}.`,
    },
    riskSignals,
    coverageRecommendations,
    brokerCallPacket,
    evidence: scenario.evidence,
    trace,
    disclaimers: [
      "Coverage recommendations are broker-prep considerations, not licensed insurance advice.",
      "Verify all findings with the insured and carrier underwriting guidelines.",
      "Third-party data availability varies by provider and API configuration.",
      "Demo mode uses synthetic fixture evidence for the researched business.",
    ],
  } satisfies RiskReport;

  return riskReportSchema.parse(report);
}

const daycareEvidence = [
  createEvidenceItem({
    sourceType: "fixture",
    title: "Program overview",
    snippet:
      "Little Orchard Learning Studio offers weekday daycare, preschool classes, summer camp sessions, and birthday parties for kids ages 3-8.",
    confidence: "high",
  }),
  createEvidenceItem({
    sourceType: "fixture",
    title: "Admissions page",
    snippet:
      "Families can register online, store emergency contacts, and pay tuition through a parent portal. The center highlights a team of 14 staff members.",
    confidence: "high",
  }),
  createEvidenceItem({
    sourceType: "fixture",
    title: "Facility details",
    snippet:
      "Customers use a shared parking lot for morning drop-off and pickup. Weekend special events include kids art classes and seasonal camps.",
    confidence: "medium",
  }),
];

const restaurantEvidence = [
  createEvidenceItem({
    sourceType: "fixture",
    title: "Menu and services",
    snippet:
      "Northline Tavern & Kitchen serves beer, wine, cocktails, weekday lunch, late-night food, and catering for office events.",
    confidence: "high",
  }),
  createEvidenceItem({
    sourceType: "fixture",
    title: "Ordering flow",
    snippet:
      "Guests can place online orders, save customer accounts, and pay through the restaurant website. Delivery is available within five miles.",
    confidence: "high",
  }),
  createEvidenceItem({
    sourceType: "fixture",
    title: "Operations note",
    snippet:
      "The bar uses third-party drivers and staff pickup for catering trays. Customer foot traffic peaks during sports nights and weekend events.",
    confidence: "medium",
  }),
];

const manufacturerEvidence = [
  createEvidenceItem({
    sourceType: "fixture",
    title: "Operations page",
    snippet:
      "Redline Fabrication Works manufactures light metal components, operates welding equipment and CNC machinery, and stores finished inventory in a warehouse.",
    confidence: "high",
  }),
  createEvidenceItem({
    sourceType: "fixture",
    title: "Field service note",
    snippet:
      "Technicians perform onsite installation and repair work using mobile tools and job-site equipment. The company maintains a team of 22 staff members.",
    confidence: "high",
  }),
  createEvidenceItem({
    sourceType: "fixture",
    title: "Property note",
    snippet:
      "The production facility is in an older industrial building with unknown renovation history. Forklifts and compressors are critical to daily output.",
    confidence: "medium",
  }),
];

const manufacturerPropertyEvidence = createEvidenceItem({
  sourceType: "fixture",
  title: "Building age note",
  snippet:
    "Assume an older industrial property for demo purposes. Treat potential asbestos/PACM only as a due diligence flag.",
  confidence: "low",
});

const manufacturerScenarioEvidence = [
  ...manufacturerEvidence,
  manufacturerPropertyEvidence,
];

const scenarios: Record<FixtureKey, FixtureScenario> = {
  daycare: {
    key: "daycare",
    label: "Daycare",
    exampleInput: "Little Orchard Learning Studio, Oakland",
    snapshot: {
      name: "Little Orchard Learning Studio",
      website: "https://littleorchard-learning.demo",
      address: "1840 Grove Street, Oakland, CA 94612",
      phone: "(510) 555-0184",
      categories: ["daycare", "preschool", "children's classes"],
      operatingSummary:
        "Childcare center offering weekday daycare, preschool enrichment, camps, classes, and birthday parties from a single leased location.",
      locationsDetected: 1,
      employeeEstimate: "10-20 employees",
    },
    evidence: daycareEvidence,
    flood: null,
    property: null,
  },
  "restaurant-delivery": {
    key: "restaurant-delivery",
    label: "Restaurant + delivery",
    exampleInput: "Northline Tavern & Kitchen, Denver",
    snapshot: {
      name: "Northline Tavern & Kitchen",
      website: "https://northline-tavern.demo",
      address: "4128 Blake Street, Denver, CO 80216",
      phone: "(303) 555-0128",
      categories: ["restaurant", "bar", "delivery"],
      operatingSummary:
        "Neighborhood tavern with dine-in food service, alcohol sales, catering, and a mix of in-house and third-party delivery.",
      locationsDetected: 1,
      employeeEstimate: "15-30 employees",
    },
    evidence: restaurantEvidence,
    flood: null,
    property: null,
  },
  manufacturer: {
    key: "manufacturer",
    label: "Manufacturer",
    exampleInput: "Redline Fabrication Works, Akron",
    snapshot: {
      name: "Redline Fabrication Works",
      website: "https://redline-fabrication.demo",
      address: "700 Mercer Avenue, Akron, OH 44311",
      phone: "(330) 555-0177",
      categories: ["light manufacturing", "installation", "warehouse"],
      operatingSummary:
        "Light manufacturer producing fabricated components with warehouse storage, mobile tools, and field installation support.",
      locationsDetected: 1,
      employeeEstimate: "20-40 employees",
    },
    evidence: manufacturerScenarioEvidence,
    flood: null,
    property: {
      buildingYear: null,
      olderPropertyUnknown: true,
      evidenceId: manufacturerPropertyEvidence.id,
    },
  },
};

export function fixtureCatalog() {
  return Object.values(scenarios).map((scenario) => ({
    key: scenario.key,
    label: scenario.label,
    input: scenario.exampleInput,
  }));
}

export function fixtureForInput(input: string) {
  const normalized = input.toLowerCase();

  if (
    normalized.includes("daycare") ||
    normalized.includes("camp") ||
    normalized.includes("preschool")
  ) {
    return scenarios.daycare;
  }
  if (
    normalized.includes("restaurant") ||
    normalized.includes("bar") ||
    normalized.includes("delivery") ||
    normalized.includes("tavern")
  ) {
    return scenarios["restaurant-delivery"];
  }
  if (
    normalized.includes("manufacturer") ||
    normalized.includes("fabrication") ||
    normalized.includes("warehouse")
  ) {
    return scenarios.manufacturer;
  }

  return null;
}

export function buildFixtureReport(key: FixtureKey, input?: string) {
  return buildScenarioReports(scenarios[key], input);
}

export function buildFixtureReportForInput(input: string) {
  const fixture = fixtureForInput(input) ?? scenarios.daycare;
  return buildScenarioReports(fixture, input);
}
