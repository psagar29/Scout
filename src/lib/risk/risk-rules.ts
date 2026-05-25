import type {
  BusinessSnapshot,
  EvidenceItem,
  RiskSignal,
  RiskSignalCategory,
} from "@/lib/risk/report-schema";
import { uniqueEvidenceIds } from "@/lib/research/evidence";

type Rule = {
  id: string;
  label: string;
  category: RiskSignalCategory;
  severity: 1 | 2 | 3 | 4 | 5;
  confidence: RiskSignal["confidence"];
  keywords: string[];
  whyItMatters: string;
  coverageImplications: RiskSignal["coverageImplications"];
};

type FloodFacts = {
  zone: string | null;
  subType: string | null;
  isSpecialFloodHazardArea: boolean;
  evidenceId?: string;
} | null;

type PropertyFacts = {
  buildingYear: number | null;
  olderPropertyUnknown: boolean;
  evidenceId?: string;
} | null;

const RULES: Rule[] = [
  {
    id: "premises-traffic",
    label: "Customer foot traffic and premises exposure",
    category: "premises",
    severity: 3,
    confidence: "medium",
    keywords: [
      "parking lot",
      "valet",
      "customer pickup",
      "foot traffic",
      "coworking",
      "meeting rooms",
      "event space",
      "workspace",
      "office space",
      "salon",
      "retail",
      "storefront",
      "showroom",
      "walk-in",
      "lobby",
      "reception",
      "visitors",
      "open to the public",
      "incubator",
    ],
    whyItMatters:
      "Public-facing operations and parking activity can increase slip, fall, and third-party injury exposure.",
    coverageImplications: ["General Liability", "Umbrella"],
  },
  {
    id: "auto-operations",
    label: "Driving or delivery operations",
    category: "auto",
    severity: 4,
    confidence: "high",
    keywords: [
      "delivery",
      "catering",
      "mobile service",
      "drivers",
      "van",
      "truck",
    ],
    whyItMatters:
      "Off-premises driving activity creates vehicle liability exposure even when a business relies on employee-owned vehicles.",
    coverageImplications: [
      "Commercial Auto",
      "Hired and Non-Owned Auto",
    ],
  },
  {
    id: "child-safety",
    label: "Child supervision or youth programming exposure",
    category: "child_safety",
    severity: 5,
    confidence: "high",
    keywords: [
      "kids",
      "birthday parties",
      "daycare",
      "classes",
      "camp",
      "youth",
    ],
    whyItMatters:
      "Care, instruction, or events involving children raise supervision, injury, and abuse/molestation questions.",
    coverageImplications: [
      "Abuse/Molestation",
      "Participant Accident",
      "General Liability",
      "Workers Compensation",
      "Special Event",
    ],
  },
  {
    id: "liquor",
    label: "Alcohol service exposure",
    category: "liquor",
    severity: 4,
    confidence: "high",
    keywords: ["beer", "wine", "cocktails", "bar", "byob", "alcohol"],
    whyItMatters:
      "Alcohol service can change the liability stack and carrier appetite quickly.",
    coverageImplications: ["Liquor Liability", "General Liability", "Umbrella"],
  },
  {
    id: "food-product",
    label: "Food handling or prepared product exposure",
    category: "product",
    severity: 4,
    confidence: "high",
    keywords: ["food", "allergy", "catering", "meal prep"],
    whyItMatters:
      "Prepared food operations create product and foodborne illness questions beyond standard premises exposure.",
    coverageImplications: ["Product Liability", "General Liability"],
  },
  {
    id: "contracted-work",
    label: "Installation, repair, or onsite service work",
    category: "professional",
    severity: 4,
    confidence: "high",
    keywords: ["contractors", "installation", "repair", "onsite service"],
    whyItMatters:
      "Client-site work introduces completed operations, workmanship, and tools-in-transit exposure.",
    coverageImplications: [
      "General Liability",
      "Professional Liability / E&O",
      "Inland Marine",
    ],
  },
  {
    id: "property-equipment",
    label: "Equipment, tools, or industrial property exposure",
    category: "property",
    severity: 4,
    confidence: "high",
    keywords: [
      "equipment",
      "tools",
      "machinery",
      "warehouse",
      "manufacturing",
    ],
    whyItMatters:
      "Machinery, inventory, and industrial workflows expand first-party property and workplace injury exposure.",
    coverageImplications: [
      "Property/BPP",
      "Equipment Breakdown",
      "Inland Marine",
      "Workers Compensation",
    ],
  },
  {
    id: "cyber",
    label: "Customer data or online transaction exposure",
    category: "cyber",
    severity: 3,
    confidence: "medium",
    keywords: [
      "online booking",
      "customer accounts",
      "payments",
      "medical data",
      "personal data",
      "membership",
      "members",
      "portal",
      "sign up",
      "registration",
      "e-commerce",
      "checkout",
    ],
    whyItMatters:
      "Online reservations, payments, or stored personal information create cyber and privacy questions.",
    coverageImplications: ["Cyber Liability"],
  },
  {
    id: "staffing",
    label: "Meaningful staffing footprint",
    category: "workers",
    severity: 3,
    confidence: "medium",
    keywords: [
      "multiple employees",
      "hiring",
      "staff",
      "team",
      "employees",
      "professionals",
      "entrepreneurs",
    ],
    whyItMatters:
      "A broader workforce expands payroll-driven workers compensation and employment practices exposure.",
    coverageImplications: ["Workers Compensation", "EPLI"],
  },
];

function normalizedCorpus(snapshot: BusinessSnapshot, evidence: EvidenceItem[]) {
  return [
    snapshot.name,
    snapshot.operatingSummary,
    snapshot.categories.join(" "),
    ...evidence.flatMap((item) => [item.title, item.snippet]),
  ]
    .join("\n")
    .toLowerCase();
}

function matchingEvidenceIds(keywords: string[], evidence: EvidenceItem[]) {
  return uniqueEvidenceIds(
    evidence
      .filter((item) => {
        const text = `${item.title}\n${item.snippet}`.toLowerCase();
        return keywords.some((keyword) => text.includes(keyword));
      })
      .map((item) => item.id),
  );
}

export function deriveDeterministicRiskSignals(input: {
  snapshot: BusinessSnapshot;
  evidence: EvidenceItem[];
  flood: FloodFacts;
  property: PropertyFacts;
}): RiskSignal[] {
  const corpus = normalizedCorpus(input.snapshot, input.evidence);
  const signals: RiskSignal[] = [];

  for (const rule of RULES) {
    const matchedKeywords = rule.keywords.filter((keyword) =>
      corpus.includes(keyword),
    );
    if (matchedKeywords.length === 0) continue;

    const evidenceIds = matchingEvidenceIds(matchedKeywords, input.evidence);

    signals.push({
      id: rule.id,
      label: rule.label,
      category: rule.category,
      severity: rule.severity,
      confidence: evidenceIds.length >= 2 ? "high" : rule.confidence,
      whyItMatters: rule.whyItMatters,
      evidenceIds,
      coverageImplications: rule.coverageImplications,
    });
  }

  if (input.flood?.isSpecialFloodHazardArea) {
    signals.push({
      id: "fema-flood-zone",
      label: `FEMA flood zone review: ${input.flood.zone ?? "special flood hazard area"}`,
      category: "catastrophe",
      severity: 4,
      confidence: "high",
      whyItMatters:
        "FEMA indicates a mapped flood hazard at this location, which changes property and business income review priorities.",
      evidenceIds: input.flood.evidenceId ? [input.flood.evidenceId] : [],
      coverageImplications: ["Flood", "Business Income"],
    });
  }

  if (
    input.property &&
    ((input.property.buildingYear !== null && input.property.buildingYear < 1981) ||
      input.property.olderPropertyUnknown)
  ) {
    const detail =
      input.property.buildingYear !== null
        ? `Building year ${input.property.buildingYear}`
        : "Property age not confirmed";
    signals.push({
      id: "older-property-due-diligence",
      label: "Older property due diligence flag",
      category: "environmental",
      severity: 3,
      confidence: input.property.buildingYear !== null ? "medium" : "low",
      whyItMatters: `${detail}. Treat potential asbestos/PACM as a due diligence flag, not a confirmed condition.`,
      evidenceIds: input.property.evidenceId ? [input.property.evidenceId] : [],
      coverageImplications: ["Property/BPP", "Business Income"],
    });
  }

  return signals.sort((left, right) => right.severity - left.severity);
}
