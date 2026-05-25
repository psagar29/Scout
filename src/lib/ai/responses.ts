import {
  type CodexSession,
  codexOriginator,
} from "@/lib/auth/codex-oauth";
import type { ResearchSynthesisPayload } from "@/lib/research/orchestrator";
import { riskReportSchema, type RiskReport } from "@/lib/risk/report-schema";

const DEFAULT_CODEX_RESPONSES_ENDPOINT =
  "https://chatgpt.com/backend-api/codex/responses";
const DEFAULT_CODEX_RESPONSES_MODEL = "gpt-5.4-mini";
const DEFAULT_OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const DEFAULT_OPENAI_RESPONSES_MODEL = "gpt-5.4-mini";

const SYSTEM_PROMPT =
  "You are an expert commercial insurance brokerage research agent. Your job is to produce broker-prep risk reports from source evidence. Do not invent facts. Every material risk or coverage recommendation must cite evidence IDs. Distinguish observed facts from assumptions. Use cautious insurance language: coverage considerations, not binding advice. Return JSON only matching schema.";

export type ReportGenerationResult = {
  report: RiskReport;
  model: string;
};

type StreamReadState = {
  deltaText: string;
  finalText: string | null;
  errorMessage: string | null;
};

function configuredEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function codexResponsesEndpoint() {
  return (
    configuredEnv("CODEX_RESPONSES_ENDPOINT") ?? DEFAULT_CODEX_RESPONSES_ENDPOINT
  );
}

function codexResponsesModel() {
  return configuredEnv("CODEX_RESPONSES_MODEL") ?? DEFAULT_CODEX_RESPONSES_MODEL;
}

function openAIResponsesEndpoint() {
  return (
    configuredEnv("OPENAI_RESPONSES_ENDPOINT") ??
    DEFAULT_OPENAI_RESPONSES_ENDPOINT
  );
}

function openAIResponsesModel() {
  return configuredEnv("OPENAI_RESPONSES_MODEL") ?? DEFAULT_OPENAI_RESPONSES_MODEL;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function extractText(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return null;

  const outputText = record.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText;
  }

  const output = record.output;
  if (!Array.isArray(output)) return null;

  const chunks = output.flatMap((item) => {
    const itemRecord = asRecord(item);
    if (!itemRecord) return [];
    const content = itemRecord.content;
    if (!Array.isArray(content)) return [];

    return content.flatMap((contentItem) => {
      const contentRecord = asRecord(contentItem);
      if (!contentRecord) return [];
      const text = contentRecord.text;
      if (typeof text === "string") return [text];
      const textRecord = asRecord(text);
      if (textRecord && typeof textRecord.value === "string") {
        return [textRecord.value];
      }
      return [];
    });
  });

  const extracted = chunks.join("\n").trim();
  return extracted || null;
}

function fencedCodeBlocks(text: string) {
  const lines = text.split(/\r?\n/);
  const payloads: string[] = [];
  let payloadLines: string[] = [];
  let isInsideFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!isInsideFence) {
      if (trimmed.startsWith("```")) isInsideFence = true;
      continue;
    }

    if (trimmed.startsWith("```")) {
      payloads.push(payloadLines.join("\n").trim());
      payloadLines = [];
      isInsideFence = false;
      continue;
    }

    payloadLines.push(line);
  }

  if (isInsideFence) payloads.push(payloadLines.join("\n").trim());

  return payloads;
}

function jsonObjectIn(text: string) {
  let searchStart = 0;
  while (searchStart < text.length) {
    const start = text.indexOf("{", searchStart);
    if (start < 0) return null;

    let depth = 0;
    let isInsideString = false;
    let isEscaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];

      if (isInsideString) {
        if (isEscaped) {
          isEscaped = false;
        } else if (character === "\\") {
          isEscaped = true;
        } else if (character === '"') {
          isInsideString = false;
        }
      } else if (character === '"') {
        isInsideString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(start, index + 1);
          try {
            const parsed = JSON.parse(candidate);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              return candidate;
            }
          } catch {
            break;
          }
        }
      }
    }

    searchStart = start + 1;
  }

  return null;
}

function extractJSONObject(text: string) {
  const trimmed = text.trim();
  for (const fenced of fencedCodeBlocks(trimmed)) {
    const extracted = jsonObjectIn(fenced);
    if (extracted) return extracted;
  }

  return jsonObjectIn(trimmed) ?? trimmed;
}

function textFromDelta(delta: unknown) {
  if (typeof delta === "string") return delta;

  const record = asRecord(delta);
  if (!record) return null;

  return (
    stringField(record, "text") ??
    stringField(record, "value") ??
    stringField(record, "output_text") ??
    extractText(record)
  );
}

function errorMessageFrom(payload: unknown) {
  const record = asRecord(payload);
  if (!record) return null;

  const directMessage = stringField(record, "message");
  if (directMessage) return directMessage;

  const error = asRecord(record.error);
  if (!error) return null;

  return (
    stringField(error, "message") ??
    stringField(error, "detail") ??
    stringField(error, "type")
  );
}

function captureStreamPayload(
  state: StreamReadState,
  payload: unknown,
  eventType: string | null,
) {
  const record = asRecord(payload);
  if (!record) return;

  const type = stringField(record, "type") ?? eventType ?? "";
  const message = errorMessageFrom(payload);
  if (message && (type.includes("error") || type.includes("failed"))) {
    state.errorMessage = message;
  }

  const delta = textFromDelta(record.delta);
  if (delta && (type.endsWith(".delta") || type.includes("output_text"))) {
    state.deltaText += delta;
  }

  const responseText = extractText(record.response);
  if (responseText) {
    state.finalText = responseText;
  }

  const directText = extractText(record);
  if (directText && (type.endsWith(".done") || type.includes("completed"))) {
    state.finalText = directText;
  }
}

function parseSseEvent(rawEvent: string) {
  const lines = rawEvent.split("\n");
  const eventType =
    lines
      .map((line) => line.trim())
      .find((line) => line.startsWith("event:"))
      ?.slice("event:".length)
      .trim() ?? null;
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
    .trim();

  return data ? { data, eventType } : null;
}

async function readResponsesStream(response: Response, source: string) {
  if (!response.body) {
    throw new Error(`${source} Responses returned an empty stream.`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state: StreamReadState = {
    deltaText: "",
    finalText: null,
    errorMessage: null,
  };
  let buffer = "";

  const consumeBufferedEvents = () => {
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");

    while (boundary >= 0) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseEvent(rawEvent);

      if (parsed && parsed.data !== "[DONE]") {
        try {
          captureStreamPayload(
            state,
            JSON.parse(parsed.data) as unknown,
            parsed.eventType,
          );
        } catch {
          if (parsed.eventType?.includes("text")) state.deltaText += parsed.data;
        }
      }

      boundary = buffer.indexOf("\n\n");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    consumeBufferedEvents();
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    buffer += "\n\n";
    consumeBufferedEvents();
  }

  if (state.errorMessage) {
    throw new Error(`${source} stream failed: ${state.errorMessage}`);
  }

  const text = (state.deltaText || state.finalText || "").trim();
  if (!text) {
    throw new Error(`${source} Responses returned no readable text.`);
  }

  return text;
}

async function readResponsesText(response: Response, source: string) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    return readResponsesStream(response, source);
  }

  const payload = (await response.json().catch(async () => {
    const text = await response.text().catch(() => "");
    return text ? { output_text: text } : null;
  })) as unknown;
  const text = extractText(payload);
  if (!text) {
    throw new Error(`${source} Responses returned no readable text.`);
  }

  return text;
}

function reportInstructions() {
  return `${SYSTEM_PROMPT}

Return only valid JSON. Do not wrap it in Markdown. Preserve evidence IDs exactly. Prefer using the supplied draft report as the baseline and improve only the synthesis, wording, and prioritization where evidence supports it.

Schema:
{
  "id": string,
  "createdAt": string,
  "input": string,
  "snapshot": {
    "name": string,
    "website"?: string,
    "address"?: string,
    "phone"?: string,
    "categories": string[],
    "operatingSummary": string,
    "locationsDetected": number | null,
    "employeeEstimate": string | null
  },
  "riskSignals": [{
    "id": string,
    "label": string,
    "category": "premises" | "auto" | "workers" | "liquor" | "cyber" | "property" | "professional" | "product" | "child_safety" | "environmental" | "catastrophe",
    "severity": 1 | 2 | 3 | 4 | 5,
    "confidence": "low" | "medium" | "high",
    "whyItMatters": string,
    "evidenceIds": string[],
    "coverageImplications": string[]
  }],
  "coverageRecommendations": [{
    "coverage": string,
    "priority": "required" | "recommended" | "consider",
    "reason": string,
    "evidenceIds": string[],
    "askOnCall": string[],
    "missingData": string[]
  }],
  "brokerCallPacket": {
    "opener": string,
    "questions": string[],
    "likelyObjections": [{"objection": string, "response": string}],
    "underwriterNotes": string[],
    "followUpDocuments": string[]
  },
  "evidence": [{"id": string, "sourceType": string, "title": string, "url"?: string, "snippet": string, "fetchedAt": string, "confidence": "low" | "medium" | "high"}],
  "trace": [{"id": string, "label": string, "status": "complete" | "skipped" | "warning" | "error", "detail": string, "evidenceIds": string[]}],
  "disclaimers": string[]
}`;
}

function mergedReportCandidate(
  base: RiskReport,
  candidate: unknown,
): RiskReport | null {
  const record = asRecord(candidate);
  if (!record) return null;
  const brokerCallPacketRecord = asRecord(record.brokerCallPacket);
  const likelyObjections = Array.isArray(brokerCallPacketRecord?.likelyObjections)
    ? brokerCallPacketRecord.likelyObjections
        .map((item) => {
          const objection = asRecord(item);
          if (!objection) return null;

          return {
            objection: stringField(objection, "objection"),
            response: stringField(objection, "response"),
          };
        })
        .filter(
          (
            item,
          ): item is {
            objection: string;
            response: string;
          } => Boolean(item?.objection && item.response),
        )
    : base.brokerCallPacket.likelyObjections;
  const brokerQuestions = Array.isArray(brokerCallPacketRecord?.questions)
    ? brokerCallPacketRecord.questions.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : base.brokerCallPacket.questions;
  const underwriterNotes = Array.isArray(brokerCallPacketRecord?.underwriterNotes)
    ? brokerCallPacketRecord.underwriterNotes.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : base.brokerCallPacket.underwriterNotes;
  const followUpDocuments = Array.isArray(
    brokerCallPacketRecord?.followUpDocuments,
  )
    ? brokerCallPacketRecord.followUpDocuments.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : base.brokerCallPacket.followUpDocuments;

  const merged = {
    id: base.id,
    createdAt: base.createdAt,
    input: base.input,
    snapshot: {
      ...base.snapshot,
      ...(asRecord(record.snapshot) ?? {}),
    },
    riskSignals: Array.isArray(record.riskSignals)
      ? record.riskSignals
      : base.riskSignals,
    coverageRecommendations: Array.isArray(record.coverageRecommendations)
      ? record.coverageRecommendations
      : base.coverageRecommendations,
    brokerCallPacket: {
      ...base.brokerCallPacket,
      opener:
        stringField(brokerCallPacketRecord ?? {}, "opener") ??
        base.brokerCallPacket.opener,
      questions:
        brokerQuestions.length > 0
          ? brokerQuestions
          : base.brokerCallPacket.questions,
      likelyObjections,
      underwriterNotes:
        underwriterNotes.length > 0
          ? underwriterNotes
          : base.brokerCallPacket.underwriterNotes,
      followUpDocuments:
        followUpDocuments.length > 0
          ? followUpDocuments
          : base.brokerCallPacket.followUpDocuments,
    },
    evidence: base.evidence,
    trace: base.trace,
    disclaimers: Array.isArray(record.disclaimers)
      ? [...new Set([...base.disclaimers, ...record.disclaimers.filter((item): item is string => typeof item === "string" && item.trim().length > 0)])]
      : base.disclaimers,
  };

  const parsed = riskReportSchema.safeParse(merged);
  return parsed.success ? parsed.data : null;
}

function parseModelReport(text: string, base: RiskReport) {
  const json = extractJSONObject(text);
  const parsed = mergedReportCandidate(base, JSON.parse(json));
  if (parsed) return parsed;

  return {
    ...base,
    disclaimers: [
      ...base.disclaimers,
      "AI synthesis returned an invalid structure. Showing deterministic base report.",
    ],
  };
}

function reportPayloadText(payload: ResearchSynthesisPayload) {
  return JSON.stringify(
    {
      normalizedBusinessInput: payload.normalizedInput,
      websiteFacts: payload.websiteFacts,
      mapListingFacts: payload.googlePlacesFacts,
      reviewExcerpts: {
        googlePlaces: payload.googlePlacesFacts?.raw.reviews ?? [],
        yelp: payload.yelpFacts?.evidence
          .filter((item) => item.title.toLowerCase().includes("review"))
          .map((item) => item.snippet) ?? [],
      },
      femaGeocodeFacts: {
        geocode: payload.geocodeFacts,
        flood: payload.femaFacts,
      },
      deterministicRiskSignals: payload.draftReport.riskSignals,
      evidenceList: payload.draftReport.evidence,
      draftReport: payload.draftReport,
    },
    null,
    2,
  );
}

async function synthesizeFromText(
  text: string,
  base: RiskReport,
  model: string,
) {
  return {
    report: parseModelReport(text, base),
    model,
  } satisfies ReportGenerationResult;
}

export async function synthesizeRiskReportWithCodex(
  session: CodexSession,
  payload: ResearchSynthesisPayload,
): Promise<ReportGenerationResult> {
  const model = codexResponsesModel();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.accessToken}`,
    Accept: "text/event-stream",
    "Content-Type": "application/json",
    "OpenAI-Beta": "responses=experimental",
    originator: codexOriginator(),
  };

  if (session.profile.accountId) {
    headers["chatgpt-account-id"] = session.profile.accountId;
  }

  const response = await fetch(codexResponsesEndpoint(), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      store: false,
      stream: true,
      instructions: reportInstructions(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${reportPayloadText(payload)}\n\nReturn valid JSON only.`,
            },
          ],
        },
      ],
      text: {
        verbosity: "low",
      },
      reasoning: {
        effort: "medium",
        summary: "auto",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Codex Responses failed with ${response.status}.`);
  }

  const text = await readResponsesStream(response, "Codex");
  return synthesizeFromText(text, payload.draftReport, model);
}

export async function synthesizeRiskReportWithOpenAI(
  apiKey: string,
  payload: ResearchSynthesisPayload,
): Promise<ReportGenerationResult> {
  const model = openAIResponsesModel();
  const response = await fetch(openAIResponsesEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions: reportInstructions(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${reportPayloadText(payload)}\n\nReturn valid JSON only.`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_object",
        },
      },
      reasoning: {
        effort: "medium",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Responses failed with ${response.status}.`);
  }

  const text = await readResponsesText(response, "OpenAI");
  return synthesizeFromText(text, payload.draftReport, model);
}
