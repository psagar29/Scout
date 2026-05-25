import {
  buildBrokerCallPacket,
  buildCoverageRecommendations,
} from "@/lib/risk/coverage-map";
import {
  buildFixtureReportForInput,
} from "@/lib/risk/fixtures";
import {
  type BusinessSnapshot,
  type RiskReport,
  riskReportSchema,
} from "@/lib/risk/report-schema";
import { deriveDeterministicRiskSignals } from "@/lib/risk/risk-rules";
import {
  RESEARCH_STAGE_LABELS,
  createEvidenceItem,
  createTraceStep,
  sortEvidenceByConfidence,
} from "@/lib/research/evidence";
import { lookupFemaFloodZone } from "@/lib/research/fema";
import { geocodeAddressWithCensus } from "@/lib/research/geocode";
import {
  googleMapsQueryFromUrl,
  lookupGooglePlace,
  type GooglePlacesResult,
} from "@/lib/research/google-places";
import { crawlWebsite, type CrawledWebsite } from "@/lib/research/website-crawler";
import { lookupYelpBusiness, type YelpResult } from "@/lib/research/yelp";

type NormalizedInput = {
  raw: string;
  kind: "website" | "google_maps" | "query";
  query: string;
  website: string | null;
  domainHint: string | null;
};

export type ResearchSynthesisPayload = {
  draftReport: RiskReport;
  normalizedInput: NormalizedInput;
  websiteFacts: CrawledWebsite | null;
  googlePlacesFacts: GooglePlacesResult | null;
  yelpFacts: YelpResult | null;
  geocodeFacts:
    | {
        matchedAddress: string;
        latitude: number;
        longitude: number;
      }
    | null;
  femaFacts:
    | {
        zone: string | null;
        subType: string | null;
        isSpecialFloodHazardArea: boolean;
      }
    | null;
};

export type ReportSynthesizer = (
  payload: ResearchSynthesisPayload,
) => Promise<{ report: RiskReport; model: string }>;

function normalizeInput(rawInput: string): NormalizedInput {
  const raw = rawInput.trim();
  const googleMapsQuery = googleMapsQueryFromUrl(raw);
  if (googleMapsQuery) {
    return {
      raw,
      kind: "google_maps",
      query: googleMapsQuery,
      website: null,
      domainHint: null,
    };
  }

  try {
    const withProtocol = /^https?:\/\//iu.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    if (url.hostname.includes(".")) {
      return {
        raw,
        kind: "website",
        query: url.hostname.replace(/^www\./u, ""),
        website: url.toString(),
        domainHint: url.hostname.replace(/^www\./u, ""),
      };
    }
  } catch {
    // fall through
  }

  return {
    raw,
    kind: "query",
    query: raw,
    website: null,
    domainHint: null,
  };
}

function titleFromDomain(domain: string | null) {
  if (!domain) return null;
  return domain
    .split(".")[0]
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function inferCategoriesFromText(value: string) {
  const text = value.toLowerCase();
  const categories = new Set<string>();
  if (/(daycare|preschool|camp|kids|child)/u.test(text)) {
    categories.add("childcare");
  }
  if (/(restaurant|tavern|kitchen|bar|delivery|catering)/u.test(text)) {
    categories.add("restaurant");
  }
  if (/(manufacturer|fabrication|warehouse|machinery|industrial)/u.test(text)) {
    categories.add("manufacturing");
  }
  if (/(contractor|installation|repair|onsite service)/u.test(text)) {
    categories.add("contractor");
  }
  if (/(coworking|workspace|incubator|shared office|meeting room)/u.test(text)) {
    categories.add("coworking");
  }
  if (/(salon|spa|beauty|barbershop|wellness)/u.test(text)) {
    categories.add("personal services");
  }
  if (/(retail|store|shop|boutique|showroom)/u.test(text)) {
    categories.add("retail");
  }
  if (/(gym|fitness|yoga|crossfit|training)/u.test(text)) {
    categories.add("fitness");
  }
  if (/(clinic|medical|dental|chiropractic|therapy)/u.test(text)) {
    categories.add("healthcare");
  }
  if (/(auto repair|mechanic|body shop|car wash|detailing)/u.test(text)) {
    categories.add("automotive");
  }
  return [...categories];
}

function baseDisclaimers() {
  return [
    "Coverage recommendations are broker-prep considerations, not licensed insurance advice.",
    "Verify all findings with the insured and carrier underwriting guidelines.",
    "Third-party data availability varies by provider and API configuration.",
  ];
}

function mergeSnapshot(input: {
  normalized: NormalizedInput;
  websiteFacts: CrawledWebsite | null;
  googlePlacesFacts: GooglePlacesResult | null;
  yelpFacts: YelpResult | null;
  evidenceSummary: string;
}): BusinessSnapshot {
  const categories = new Set<string>([
    ...(input.googlePlacesFacts?.categories ?? []),
    ...(input.yelpFacts?.categories ?? []),
    ...(input.websiteFacts?.categories ?? []),
    ...inferCategoriesFromText(input.normalized.query),
  ]);
  const name =
    input.googlePlacesFacts?.name ??
    input.websiteFacts?.extractedName ??
    input.yelpFacts?.name ??
    titleFromDomain(input.normalized.domainHint) ??
    input.normalized.query;
  const website =
    input.websiteFacts?.website ??
    input.googlePlacesFacts?.website ??
    input.normalized.website ??
    undefined;
  const address =
    input.googlePlacesFacts?.address ??
    input.websiteFacts?.address ??
    input.yelpFacts?.address ??
    undefined;
  const phone =
    input.googlePlacesFacts?.phone ??
    input.websiteFacts?.phone ??
    input.yelpFacts?.phone ??
    undefined;
  const summarySource =
    input.websiteFacts?.combinedText ||
    input.evidenceSummary ||
    input.normalized.query;
  const operatingSummary = summarySource.length > 360
    ? `${summarySource.slice(0, 360).replace(/\s+\S*$/u, "")}...`
    : summarySource;

  return {
    name,
    website,
    address,
    phone,
    categories: [...categories].slice(0, 8),
    operatingSummary,
    locationsDetected: 1,
    employeeEstimate:
      /team|staff|employees?/iu.test(summarySource) ? "Multiple employees indicated" : null,
  };
}

function lowConfidenceInferenceEvidence(input: NormalizedInput) {
  return createEvidenceItem({
    sourceType: "model_inference",
    title: "Best-candidate inference",
    snippet:
      input.kind === "query"
        ? `No official listing provider was configured for "${input.query}". Business type and candidate identity were inferred from the submitted text only.`
        : `Only limited source data was available for ${input.query}. Some operating assumptions are low-confidence.`,
    confidence: "low",
  });
}

export async function researchBusiness(input: string, options: {
  demoMode: boolean;
  synthesizer?: ReportSynthesizer;
}) {
  const normalized = normalizeInput(input);
  if (options.demoMode) {
    return {
      report: buildFixtureReportForInput(input),
      model: "fixture-demo",
      source: "fixture" as const,
    };
  }

  const evidence = [] as ReturnType<typeof createEvidenceItem>[];
  let websiteFacts: CrawledWebsite | null = null;
  let googlePlacesFacts: GooglePlacesResult | null = null;
  let yelpFacts: YelpResult | null = null;
  let geocodeFacts:
    | { matchedAddress: string; latitude: number; longitude: number }
    | null = null;
  let femaFacts:
    | { zone: string | null; subType: string | null; isSpecialFloodHazardArea: boolean }
    | null = null;
  const disclaimers = baseDisclaimers();

  if (normalized.kind !== "website") {
    googlePlacesFacts = await lookupGooglePlace(normalized.query);
    if (googlePlacesFacts) {
      evidence.push(...googlePlacesFacts.evidence);
      disclaimers.push(
        "Google Places may return only a subset of reviews and listing fields.",
      );
    }
  }

  const websiteUrl =
    normalized.website ?? googlePlacesFacts?.website ?? null;
  if (websiteUrl) {
    websiteFacts = await crawlWebsite(websiteUrl);
    if (websiteFacts) {
      evidence.push(...websiteFacts.evidence);
    } else {
      disclaimers.push("Website crawling timed out or returned limited content.");
    }
  } else {
    disclaimers.push(
      "No verified website was available. Research leaned more heavily on listing data and low-confidence inference.",
    );
  }

  const yelpQuery =
    googlePlacesFacts?.name && googlePlacesFacts.address
      ? `${googlePlacesFacts.name}, ${googlePlacesFacts.address}`
      : normalized.query;
  const yelp = await lookupYelpBusiness({
    query: yelpQuery,
    latitude: googlePlacesFacts?.location?.latitude ?? null,
    longitude: googlePlacesFacts?.location?.longitude ?? null,
  });
  if (yelp) {
    yelpFacts = yelp;
    evidence.push(...yelp.evidence);
    disclaimers.push("Yelp API returns review excerpts, not the full review corpus.");
  }

  if (evidence.length === 0 || (websiteFacts === null && googlePlacesFacts === null)) {
    evidence.push(lowConfidenceInferenceEvidence(normalized));
  }

  const snapshot = mergeSnapshot({
    normalized,
    websiteFacts,
    googlePlacesFacts,
    yelpFacts,
    evidenceSummary: evidence.map((item) => item.snippet).join(" "),
  });

  if (snapshot.address) {
    const geocode = await geocodeAddressWithCensus(snapshot.address);
    if (geocode) {
      geocodeFacts = {
        matchedAddress: geocode.matchedAddress,
        latitude: geocode.latitude,
        longitude: geocode.longitude,
      };
      evidence.push(geocode.evidence);
      const fema = await lookupFemaFloodZone(geocode.latitude, geocode.longitude);
      if (fema) {
        femaFacts = {
          zone: fema.zone,
          subType: fema.subType,
          isSpecialFloodHazardArea: fema.isSpecialFloodHazardArea,
        };
        evidence.push(fema.evidence);
      }
    }
  }

  const orderedEvidence = sortEvidenceByConfidence(evidence);
  const riskSignals = deriveDeterministicRiskSignals({
    snapshot,
    evidence: orderedEvidence,
    flood: femaFacts
      ? {
          ...femaFacts,
          evidenceId:
            orderedEvidence.find((item) => item.sourceType === "fema")?.id,
        }
      : null,
    property: null,
  });
  const coverageRecommendations = buildCoverageRecommendations(riskSignals);
  const brokerCallPacket = buildBrokerCallPacket({
    snapshot,
    signals: riskSignals,
    recommendations: coverageRecommendations,
  });

  const addressEvidenceIds = orderedEvidence
    .filter((item) => item.sourceType === "website" || item.sourceType === "google_places" || item.sourceType === "yelp")
    .map((item) => item.id);
  const hazardEvidenceIds = orderedEvidence
    .filter((item) => item.sourceType === "census" || item.sourceType === "fema")
    .map((item) => item.id);

  const draftReport = riskReportSchema.parse({
    id: `research-${Date.now()}`,
    createdAt: new Date().toISOString(),
    input: normalized.raw,
    snapshot,
    riskSignals,
    coverageRecommendations,
    brokerCallPacket,
    evidence: orderedEvidence,
    trace: [
      createTraceStep({
        id: "resolve",
        label: RESEARCH_STAGE_LABELS[0],
        status:
          googlePlacesFacts || normalized.kind === "website"
            ? "complete"
            : "warning",
        detail:
          googlePlacesFacts
            ? `Best listing candidate resolved to ${googlePlacesFacts.name}.`
            : normalized.kind === "website"
              ? "Input treated as direct website research."
              : "No official listing provider confirmed the business; best candidate inferred from the submitted text.",
        evidenceIds: addressEvidenceIds,
      }),
      createTraceStep({
        id: "crawl",
        label: RESEARCH_STAGE_LABELS[1],
        status: websiteFacts ? "complete" : "warning",
        detail: websiteFacts
          ? `Fetched ${websiteFacts.pages.length} public page(s).`
          : "Website crawl unavailable or no public website was found.",
        evidenceIds: websiteFacts?.evidence.map((item) => item.id) ?? [],
      }),
      createTraceStep({
        id: "extract",
        label: RESEARCH_STAGE_LABELS[2],
        status: "complete",
        detail: `Built operating snapshot for ${snapshot.name}.`,
        evidenceIds: orderedEvidence.slice(0, 4).map((item) => item.id),
      }),
      createTraceStep({
        id: "maps",
        label: RESEARCH_STAGE_LABELS[3],
        status:
          googlePlacesFacts || yelpFacts ? "complete" : "skipped",
        detail:
          googlePlacesFacts || yelpFacts
            ? "Official listing and review excerpts checked where available."
            : "No listing review APIs were configured for this run.",
        evidenceIds: orderedEvidence
          .filter(
            (item) =>
              item.sourceType === "google_places" || item.sourceType === "yelp",
          )
          .map((item) => item.id),
      }),
      createTraceStep({
        id: "hazards",
        label: RESEARCH_STAGE_LABELS[4],
        status: geocodeFacts ? "complete" : "warning",
        detail: geocodeFacts
          ? "Census geocode and FEMA flood lookup completed."
          : "Could not geocode a verified address for hazard checks.",
        evidenceIds: hazardEvidenceIds,
      }),
      createTraceStep({
        id: "map-risks",
        label: RESEARCH_STAGE_LABELS[5],
        status: "complete",
        detail: `Deterministic rules mapped ${riskSignals.length} risk signal(s) to ${coverageRecommendations.length} coverage consideration(s).`,
        evidenceIds: riskSignals.flatMap((signal) => signal.evidenceIds).slice(0, 10),
      }),
      createTraceStep({
        id: "packet",
        label: RESEARCH_STAGE_LABELS[6],
        status: "complete",
        detail: "Base broker packet drafted and sent for model synthesis.",
        evidenceIds: coverageRecommendations.flatMap((item) => item.evidenceIds).slice(0, 10),
      }),
    ],
    disclaimers: [...new Set(disclaimers)],
  });

  if (!options.synthesizer) {
    return {
      report: {
        ...draftReport,
        disclaimers: [
          ...draftReport.disclaimers,
          "AI synthesis was unavailable. Showing deterministic base report.",
        ],
      },
      model: "deterministic-base",
      source: "provider" as const,
    };
  }

  let synthesized:
    | Awaited<ReturnType<ReportSynthesizer>>
    | null = null;

  try {
    synthesized = await options.synthesizer({
      draftReport,
      normalizedInput: normalized,
      websiteFacts,
      googlePlacesFacts,
      yelpFacts,
      geocodeFacts,
      femaFacts,
    });
  } catch {
    synthesized = null;
  }

  if (!synthesized) {
    return {
      report: {
        ...draftReport,
        disclaimers: [
          ...draftReport.disclaimers,
          "AI synthesis failed. Showing deterministic base report.",
        ],
      },
      model: "deterministic-base",
      source: "provider" as const,
    };
  }

  return {
    report: synthesized.report,
    model: synthesized.model,
    source: "provider" as const,
  };
}
