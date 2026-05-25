import type {
  BrokerCallPacket,
  BusinessSnapshot,
  CoverageName,
  CoverageRecommendation,
  RiskSignal,
} from "@/lib/risk/report-schema";
import { uniqueEvidenceIds } from "@/lib/research/evidence";

type CoverageGuide = {
  askOnCall: string[];
  missingData: string[];
};

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => value.trim().length > 0))];
}

function humanJoin(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

const COVERAGE_GUIDES: Record<CoverageName, CoverageGuide> = {
  "General Liability": {
    askOnCall: [
      "What does daily customer foot traffic look like?",
      "Any loss history involving slips, falls, or third-party injuries?",
    ],
    missingData: ["Five-year GL loss runs", "Premises occupancy details"],
  },
  "Property/BPP": {
    askOnCall: [
      "What are the replacement values for contents, stock, and equipment?",
      "Any landlord requirements or tenant improvements to schedule?",
    ],
    missingData: ["Building and BPP valuation", "Construction and protection details"],
  },
  "Business Income": {
    askOnCall: [
      "How long could the business operate if the location was unusable?",
      "Any seasonal revenue concentration or single-location dependence?",
    ],
    missingData: ["Gross revenue trend", "Estimated restoration period"],
  },
  "Workers Compensation": {
    askOnCall: [
      "How many employees are on payroll and what do they do?",
      "Any subcontracted labor or unusual class code exposure?",
    ],
    missingData: ["Payroll split by class code", "Loss runs"],
  },
  "Commercial Auto": {
    askOnCall: [
      "Are vehicles owned, leased, or financed by the business?",
      "What are the driver count, MVR standards, and radius of operation?",
    ],
    missingData: ["Vehicle schedule", "Driver list"],
  },
  "Hired and Non-Owned Auto": {
    askOnCall: [
      "Do employees use personal vehicles for deliveries or errands?",
      "Any third-party delivery platforms or independent drivers involved?",
    ],
    missingData: ["Driver reimbursement policy", "Use of employee vehicles"],
  },
  "Liquor Liability": {
    askOnCall: [
      "What percentage of revenue comes from alcohol?",
      "How are ID checks and service training handled?",
    ],
    missingData: ["Liquor sales mix", "Server training controls"],
  },
  "Cyber Liability": {
    askOnCall: [
      "Where are bookings, payments, or customer records stored?",
      "Any MFA, backups, or vendor incident response obligations?",
    ],
    missingData: ["Tech stack overview", "Data retention practices"],
  },
  EPLI: {
    askOnCall: [
      "How many employees and supervisors are in the business?",
      "What hiring, handbook, and termination practices are in place?",
    ],
    missingData: ["Employee count", "HR policy maturity"],
  },
  "Professional Liability / E&O": {
    askOnCall: [
      "Is the business giving advice, design input, or installation recommendations?",
      "Any written contracts that expand warranty or indemnity obligations?",
    ],
    missingData: ["Sample client contract", "Scope-of-work process"],
  },
  "Product Liability": {
    askOnCall: [
      "What products are sold or produced, and where do ingredients/components come from?",
      "Any allergy, contamination, or recall controls in place?",
    ],
    missingData: ["Supplier controls", "Recall or QA procedures"],
  },
  Umbrella: {
    askOnCall: [
      "What excess limits do landlords, vendors, or contracts require?",
      "Any severe-loss scenarios that would pierce primary limits?",
    ],
    missingData: ["Contractual limit requirements", "Underlying policy limits"],
  },
  "Inland Marine": {
    askOnCall: [
      "What equipment, tools, or property move off-site?",
      "Any high-value mobile assets or job-site storage exposure?",
    ],
    missingData: ["Mobile equipment schedule", "Transit/storage details"],
  },
  "Equipment Breakdown": {
    askOnCall: [
      "Which critical machines or refrigeration systems would halt operations if they failed?",
      "Any maintenance contracts or backup capacity?",
    ],
    missingData: ["Critical equipment list", "Maintenance history"],
  },
  Flood: {
    askOnCall: [
      "Has the location ever experienced flood or water intrusion?",
      "Is inventory or critical equipment stored below grade?",
    ],
    missingData: ["Flood loss history", "Elevation or mitigation details"],
  },
  "Abuse/Molestation": {
    askOnCall: [
      "What background checks, supervision ratios, and pickup/release controls exist?",
      "How are incidents documented and escalated?",
    ],
    missingData: ["Safeguarding policies", "Training standards"],
  },
  "Participant Accident": {
    askOnCall: [
      "What activities involve children or participants on-site?",
      "Any waivers, incident logs, or staff certifications?",
    ],
    missingData: ["Participant count", "Activity descriptions"],
  },
  "Special Event": {
    askOnCall: [
      "How often are parties, camps, or one-off events hosted?",
      "Do vendors or entertainers bring their own insurance?",
    ],
    missingData: ["Event frequency", "Vendor COI requirements"],
  },
};

function priorityFor(signal: RiskSignal): CoverageRecommendation["priority"] {
  if (signal.severity >= 4) return "required";
  if (signal.severity === 3) return "recommended";
  return "consider";
}

function priorityRank(priority: CoverageRecommendation["priority"]) {
  if (priority === "required") return 3;
  if (priority === "recommended") return 2;
  return 1;
}

export function buildCoverageRecommendations(
  signals: RiskSignal[],
): CoverageRecommendation[] {
  const byCoverage = new Map<
    CoverageName,
    {
      priority: CoverageRecommendation["priority"];
      reasons: string[];
      evidenceIds: string[];
      severities: number[];
    }
  >();

  for (const signal of signals) {
    for (const coverage of signal.coverageImplications) {
      const current = byCoverage.get(coverage);
      const nextPriority = priorityFor(signal);

      if (!current) {
        byCoverage.set(coverage, {
          priority: nextPriority,
          reasons: [signal.label],
          evidenceIds: signal.evidenceIds,
          severities: [signal.severity],
        });
        continue;
      }

      if (priorityRank(nextPriority) > priorityRank(current.priority)) {
        current.priority = nextPriority;
      }
      current.reasons.push(signal.label);
      current.evidenceIds.push(...signal.evidenceIds);
      current.severities.push(signal.severity);
    }
  }

  return [...byCoverage.entries()]
    .map(([coverage, value]) => {
      const guide = COVERAGE_GUIDES[coverage];
      const strongest = Math.max(...value.severities);
      const reasons = uniqueStrings(value.reasons).slice(0, 3);

      return {
        coverage,
        priority: value.priority,
        reason: `Triggered by ${humanJoin(reasons)}. Severity signal peak: ${strongest}/5.`,
        evidenceIds: uniqueEvidenceIds(value.evidenceIds),
        askOnCall: guide.askOnCall,
        missingData: guide.missingData,
      } satisfies CoverageRecommendation;
    })
    .sort((left, right) => {
      const priorityDelta = priorityRank(right.priority) - priorityRank(left.priority);
      if (priorityDelta !== 0) return priorityDelta;
      return left.coverage.localeCompare(right.coverage);
    });
}

export function buildBrokerCallPacket(input: {
  snapshot: BusinessSnapshot;
  signals: RiskSignal[];
  recommendations: CoverageRecommendation[];
}): BrokerCallPacket {
  const topSignals = input.signals.slice(0, 3);
  const topCoverages = input.recommendations.slice(0, 4).map((item) => item.coverage);
  const questionCandidates = uniqueStrings([
    ...topSignals.map((signal) => `Confirm ${signal.label.toLowerCase()}: ${signal.whyItMatters}`),
    ...input.recommendations.flatMap((recommendation) =>
      recommendation.askOnCall.slice(0, 1),
    ),
  ]);
  const fallbackQuestions = [
    `What are the main operations and revenue streams at ${input.snapshot.name}?`,
    "How many employees are on payroll, and what do they do day to day?",
    "Any owned vehicles, off-site work, events, or customer-facing activity we should account for?",
    "Does the public website accurately reflect current operations, services, and locations?",
  ];

  return {
    opener: `${input.snapshot.name} looks like a ${input.snapshot.categories.join(", ") || "commercial business"} account. I pulled public sources before the call and want to confirm a few operating details so we can shape the right coverage stack.`,
    questions: [...(questionCandidates.length > 0 ? questionCandidates : fallbackQuestions)].slice(0, 8),
    likelyObjections: [
      {
        objection: "We already have coverage in place.",
        response:
          "That is useful baseline data. I want to confirm whether the current program reflects how the operation actually runs today.",
      },
      {
        objection: "This feels like too much detail for a first call.",
        response:
          "The goal is speed, not paperwork. A few answers now reduce remarketing loops and underwriting surprises later.",
      },
    ],
    underwriterNotes: [
      ...topSignals.map((signal) => `${signal.label}: ${signal.whyItMatters}`),
      topCoverages.length > 0
        ? `Initial coverage stack to review: ${topCoverages.join(", ")}.`
        : "Initial coverage stack requires more operating detail.",
    ].slice(0, 6),
    followUpDocuments: [
      "Currently valued loss runs",
      "Estimated annual revenue and payroll",
      "Sample contract or service agreement",
      "Vehicle schedule if any owned autos exist",
      "Photos of premises, equipment, or operations",
    ],
  };
}
