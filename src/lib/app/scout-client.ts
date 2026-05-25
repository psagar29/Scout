import type { ResearchTraceStep, RiskReport } from "@/lib/risk/report-schema";
import { RESEARCH_STAGE_LABELS } from "@/lib/research/evidence";

export type GenerationStatus = {
  mode: "auto" | "codex" | "openai";
  provider: "codex" | "openai";
  signInRequired: boolean;
  apiKeyRequired: boolean;
  available: boolean;
  message: string | null;
};

export type AuthStatus = {
  signedIn: boolean;
  provider: "codex";
  profile?: {
    accountId: string | null;
    email: string | null;
    name: string | null;
    picture: string | null;
    planType: string | null;
  };
  expiresAt?: string;
  configuration?: {
    signInAvailable: boolean;
    problem: string | null;
    message: string | null;
  };
  generation?: GenerationStatus;
};

export type ResearchResponse = {
  report: RiskReport;
  source: "codex" | "openai" | "fixture";
  model: string;
};

export type ResultMeta = {
  source: "codex" | "openai" | "fixture";
  model: string;
};

export type Phase = "input" | "research" | "report";

export type TimelineStage = {
  label: string;
  detail: string;
  status: "idle" | "active" | "complete" | "warning" | "error";
};

export type FeedItem = {
  title: string;
  snippet: string;
  sourceType: string;
  confidence: "low" | "medium" | "high";
};

export type ExampleChip = {
  label: string;
  query: string;
};

export type FixtureChoice = {
  key: string;
  label: string;
  input: string;
};

export const OPENAI_API_KEY_STORAGE_KEY = "broker_scout_openai_api_key";

export const EXAMPLES: ExampleChip[] = [
  {
    label: "Restaurant with delivery",
    query: "restaurant with delivery",
  },
  {
    label: "Daycare center",
    query: "daycare center",
  },
  {
    label: "Light manufacturer",
    query: "light manufacturer",
  },
  {
    label: "Local bar",
    query: "local bar",
  },
];

export const FIXTURES: FixtureChoice[] = [
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
];

export const FIXTURE_SUMMARIES: Record<string, string> = {
  daycare: "Child safety, premises, staffing",
  "restaurant-delivery": "Liquor, food, delivery, payments",
  manufacturer: "Equipment, property, workers comp",
};

const DEFAULT_STAGE_DETAILS = [
  "Normalizing the business input and resolving the best candidate.",
  "Fetching up to eight relevant public pages where a website exists.",
  "Summarizing operations, staffing, and customer flow from public evidence.",
  "Checking official listing facts and review excerpts where APIs are configured.",
  "Running Census geocoding and FEMA flood lookup when address data is available.",
  "Applying deterministic insurance risk rules and coverage mappings.",
  "Building a sourced broker packet with call questions and underwriting notes.",
] as const;

export function initialTimeline(): TimelineStage[] {
  return RESEARCH_STAGE_LABELS.map((label, index) => ({
    label,
    detail: DEFAULT_STAGE_DETAILS[index],
    status: index === 0 ? "active" : "idle",
  }));
}

export function traceToTimeline(trace: ResearchTraceStep[]): TimelineStage[] {
  return RESEARCH_STAGE_LABELS.map((label, index) => {
    const step = trace.find((item) => item.label === label);
    if (!step) {
      return {
        label,
        detail: DEFAULT_STAGE_DETAILS[index],
        status: "idle",
      };
    }

    return {
      label,
      detail: step.detail,
      status:
        step.status === "complete"
          ? "complete"
          : step.status === "skipped"
            ? "warning"
            : step.status,
    };
  });
}

export function previewFeedForInput(
  value: string,
  demoMode: boolean,
): FeedItem[] {
  const normalized = value.toLowerCase();
  const items: FeedItem[] = [];

  items.push({
    title: demoMode ? "Fixture selected" : "Input normalized",
    snippet: demoMode
      ? `Demo fixture mode seeded from "${value}".`
      : `Using "${value}" as the working business candidate.`,
    sourceType: demoMode ? "fixture" : "model_inference",
    confidence: demoMode ? "high" : "low",
  });

  if (normalized.includes("http") || normalized.includes(".com")) {
    items.push({
      title: "Website candidate",
      snippet:
        "Public website fetch queued. Homepage, about, services, contact, and booking pages are prioritized.",
      sourceType: "website",
      confidence: "medium",
    });
  }

  if (/(daycare|camp|kids|preschool)/u.test(normalized)) {
    items.push({
      title: "Childcare signal",
      snippet:
        "Children's programming detected. Abuse/molestation, participant accident, and staffing questions prioritized.",
      sourceType: demoMode ? "fixture" : "model_inference",
      confidence: demoMode ? "high" : "low",
    });
  }

  if (/(restaurant|bar|delivery|catering|tavern)/u.test(normalized)) {
    items.push({
      title: "Food and alcohol signal",
      snippet:
        "Input hints at premises, liquor, product liability, and delivery exposures.",
      sourceType: demoMode ? "fixture" : "model_inference",
      confidence: demoMode ? "high" : "low",
    });
  }

  if (/(manufacturer|fabrication|warehouse|machinery)/u.test(normalized)) {
    items.push({
      title: "Industrial operations signal",
      snippet:
        "Input suggests machinery, tools, warehouse, and staffing exposure mapping to property and workers comp.",
      sourceType: demoMode ? "fixture" : "model_inference",
      confidence: demoMode ? "high" : "low",
    });
  }

  items.push({
    title: "Hazard check pending",
    snippet:
      "Address verification and FEMA flood review run only if a reliable location is found.",
    sourceType: "census",
    confidence: "medium",
  });

  return items;
}

export function packetText(report: RiskReport) {
  return [
    report.brokerCallPacket.opener,
    "",
    "Questions:",
    ...report.brokerCallPacket.questions.map((item) => `- ${item}`),
    "",
    "Underwriter notes:",
    ...report.brokerCallPacket.underwriterNotes.map((item) => `- ${item}`),
    "",
    "Follow-up documents:",
    ...report.brokerCallPacket.followUpDocuments.map((item) => `- ${item}`),
  ].join("\n");
}
