import { z } from "zod";

const confidenceSchema = z.enum(["low", "medium", "high"]);
const evidenceSourceTypeSchema = z.enum([
  "website",
  "google_places",
  "yelp",
  "fema",
  "census",
  "property",
  "model_inference",
  "fixture",
]);
const riskCategorySchema = z.enum([
  "premises",
  "auto",
  "workers",
  "liquor",
  "cyber",
  "property",
  "professional",
  "product",
  "child_safety",
  "environmental",
  "catastrophe",
]);
const coverageSchema = z.enum([
  "General Liability",
  "Property/BPP",
  "Business Income",
  "Workers Compensation",
  "Commercial Auto",
  "Hired and Non-Owned Auto",
  "Liquor Liability",
  "Cyber Liability",
  "EPLI",
  "Professional Liability / E&O",
  "Product Liability",
  "Umbrella",
  "Inland Marine",
  "Equipment Breakdown",
  "Flood",
  "Abuse/Molestation",
  "Participant Accident",
  "Special Event",
]);
const prioritySchema = z.enum(["required", "recommended", "consider"]);

export const evidenceItemSchema = z.object({
  id: z.string().min(1),
  sourceType: evidenceSourceTypeSchema,
  title: z.string().min(1),
  url: z.string().url().optional(),
  snippet: z.string().min(1),
  fetchedAt: z.string().datetime({ offset: true }),
  confidence: confidenceSchema,
});

export const businessSnapshotSchema = z.object({
  name: z.string().min(1),
  website: z.string().url().optional(),
  address: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  categories: z.array(z.string().min(1)).default([]),
  operatingSummary: z.string().min(1),
  locationsDetected: z.number().int().nullable(),
  employeeEstimate: z.string().nullable(),
});

export const riskSignalSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: riskCategorySchema,
  severity: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  confidence: confidenceSchema,
  whyItMatters: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
  coverageImplications: z.array(coverageSchema).min(1),
});

export const coverageRecommendationSchema = z.object({
  coverage: coverageSchema,
  priority: prioritySchema,
  reason: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
  askOnCall: z.array(z.string().min(1)).default([]),
  missingData: z.array(z.string().min(1)).default([]),
});

export const brokerCallPacketSchema = z.object({
  opener: z.string().min(1),
  questions: z.array(z.string().min(1)).min(1),
  likelyObjections: z
    .array(
      z.object({
        objection: z.string().min(1),
        response: z.string().min(1),
      }),
    )
    .default([]),
  underwriterNotes: z.array(z.string().min(1)).default([]),
  followUpDocuments: z.array(z.string().min(1)).default([]),
});

export const researchTraceStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["complete", "skipped", "warning", "error"]),
  detail: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).default([]),
});

export const riskReportSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    input: z.string().min(1),
    snapshot: businessSnapshotSchema,
    riskSignals: z.array(riskSignalSchema).default([]),
    coverageRecommendations: z.array(coverageRecommendationSchema).default([]),
    brokerCallPacket: brokerCallPacketSchema,
    evidence: z.array(evidenceItemSchema).default([]),
    trace: z.array(researchTraceStepSchema).default([]),
    disclaimers: z.array(z.string().min(1)).min(1),
  })
  .superRefine((report, ctx) => {
    const evidenceIds = new Set(report.evidence.map((item) => item.id));
    const hasModelInferenceEvidence = report.evidence.some(
      (item) => item.sourceType === "model_inference",
    );

    for (const signal of report.riskSignals) {
      if (signal.evidenceIds.length === 0) {
        if (!(signal.confidence === "low" && hasModelInferenceEvidence)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Risk signals need evidenceIds unless they are low-confidence model inferences.",
            path: ["riskSignals", signal.id, "evidenceIds"],
          });
        }
        continue;
      }

      for (const evidenceId of signal.evidenceIds) {
        if (!evidenceIds.has(evidenceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown evidence ID: ${evidenceId}`,
            path: ["riskSignals", signal.id, "evidenceIds"],
          });
        }
      }
    }

    for (const recommendation of report.coverageRecommendations) {
      if (recommendation.evidenceIds.length === 0 && !hasModelInferenceEvidence) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Coverage recommendations need evidenceIds unless they rely on model inference evidence.",
          path: ["coverageRecommendations", recommendation.coverage, "evidenceIds"],
        });
      }

      for (const evidenceId of recommendation.evidenceIds) {
        if (!evidenceIds.has(evidenceId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown evidence ID: ${evidenceId}`,
            path: ["coverageRecommendations", recommendation.coverage, "evidenceIds"],
          });
        }
      }
    }
  });

export type Confidence = z.infer<typeof confidenceSchema>;
export type EvidenceSourceType = z.infer<typeof evidenceSourceTypeSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type BusinessSnapshot = z.infer<typeof businessSnapshotSchema>;
export type RiskSignalCategory = z.infer<typeof riskCategorySchema>;
export type RiskSignal = z.infer<typeof riskSignalSchema>;
export type CoverageName = z.infer<typeof coverageSchema>;
export type CoverageRecommendation = z.infer<
  typeof coverageRecommendationSchema
>;
export type BrokerCallPacket = z.infer<typeof brokerCallPacketSchema>;
export type ResearchTraceStep = z.infer<typeof researchTraceStepSchema>;
export type RiskReport = z.infer<typeof riskReportSchema>;
