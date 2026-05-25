import type {
  Confidence,
  EvidenceItem,
  EvidenceSourceType,
  ResearchTraceStep,
} from "@/lib/risk/report-schema";

export const RESEARCH_STAGE_LABELS = [
  "Resolving business",
  "Crawling website",
  "Extracting operations",
  "Checking maps/reviews",
  "Checking location hazards",
  "Mapping risks to coverage",
  "Generating broker packet",
] as const;

export type ResearchStageLabel = (typeof RESEARCH_STAGE_LABELS)[number];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function evidenceNonce() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

export function createEvidenceItem(input: {
  sourceType: EvidenceSourceType;
  title: string;
  url?: string;
  snippet: string;
  confidence: Confidence;
  fetchedAt?: string;
  idHint?: string;
}): EvidenceItem {
  const base = input.idHint ? slugify(input.idHint) : slugify(input.title);

  return {
    id: `${base || "evidence"}-${evidenceNonce()}`,
    sourceType: input.sourceType,
    title: input.title.trim(),
    url: input.url,
    snippet: input.snippet.trim(),
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    confidence: input.confidence,
  };
}

export function createTraceStep(input: {
  id: string;
  label: ResearchStageLabel;
  status: ResearchTraceStep["status"];
  detail: string;
  evidenceIds?: string[];
}): ResearchTraceStep {
  return {
    id: input.id,
    label: input.label,
    status: input.status,
    detail: input.detail,
    evidenceIds: input.evidenceIds ?? [],
  };
}

export function uniqueEvidenceIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

export function sortEvidenceByConfidence(evidence: EvidenceItem[]) {
  const confidenceRank: Record<Confidence, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...evidence].sort((left, right) => {
    const confidenceDelta =
      confidenceRank[right.confidence] - confidenceRank[left.confidence];
    if (confidenceDelta !== 0) return confidenceDelta;
    return left.title.localeCompare(right.title);
  });
}

export function confidenceSummary(evidence: EvidenceItem[]) {
  const total = evidence.length;
  const weighted = evidence.reduce((sum, item) => {
    if (item.confidence === "high") return sum + 3;
    if (item.confidence === "medium") return sum + 2;
    return sum + 1;
  }, 0);
  const average = total > 0 ? weighted / total : 0;

  if (average >= 2.4) return "high" as const;
  if (average >= 1.6) return "medium" as const;
  return "low" as const;
}
