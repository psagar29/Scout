import type { RiskReport } from "@/lib/risk/report-schema";

export function exportRiskReportMarkdown(report: RiskReport) {
  const lines = [
    `# ${report.snapshot.name}`,
    "",
    `Generated: ${new Date(report.createdAt).toLocaleString()}`,
    `Input: ${report.input}`,
    "",
    "## Snapshot",
    "",
    `- Website: ${report.snapshot.website ?? "Not confirmed"}`,
    `- Address: ${report.snapshot.address ?? "Not confirmed"}`,
    `- Phone: ${report.snapshot.phone ?? "Not confirmed"}`,
    `- Categories: ${report.snapshot.categories.join(", ") || "Not confirmed"}`,
    `- Employee estimate: ${report.snapshot.employeeEstimate ?? "Not confirmed"}`,
    "",
    report.snapshot.operatingSummary,
    "",
    "## Risk Signals",
    "",
    ...report.riskSignals.flatMap((signal) => [
      `### ${signal.label}`,
      `- Category: ${signal.category}`,
      `- Severity: ${signal.severity}/5`,
      `- Confidence: ${signal.confidence}`,
      `- Coverage implications: ${signal.coverageImplications.join(", ")}`,
      `- Why it matters: ${signal.whyItMatters}`,
      "",
    ]),
    "## Coverage Recommendations",
    "",
    ...report.coverageRecommendations.flatMap((recommendation) => [
      `### ${recommendation.coverage}`,
      `- Priority: ${recommendation.priority}`,
      `- Reason: ${recommendation.reason}`,
      `- Ask on call: ${recommendation.askOnCall.join(" | ") || "None listed"}`,
      `- Missing data: ${recommendation.missingData.join(" | ") || "None listed"}`,
      "",
    ]),
    "## Broker Call Packet",
    "",
    `- Opener: ${report.brokerCallPacket.opener}`,
    `- Questions: ${report.brokerCallPacket.questions.join(" | ")}`,
    `- Underwriter notes: ${report.brokerCallPacket.underwriterNotes.join(" | ")}`,
    `- Follow-up documents: ${report.brokerCallPacket.followUpDocuments.join(" | ")}`,
    "",
    "## Evidence",
    "",
    ...report.evidence.map(
      (item) =>
        `- [${item.id}] ${item.title} (${item.sourceType}, ${item.confidence})${item.url ? ` - ${item.url}` : ""}: ${item.snippet}`,
    ),
    "",
    "## Disclaimers",
    "",
    ...report.disclaimers.map((item) => `- ${item}`),
    "",
  ];

  return lines.join("\n");
}
