import type { ResearchOutput, DecisionMakerOutput, QualificationWeights } from "../types/contracts";

/**
 * Qualification Agent prompt, per docs/spec.md §15. Research output here is
 * the agent's own already-validated structured output (not raw scraped
 * text), so it doesn't need the untrusted-content framing -- but the model
 * is still told to only score against evidence actually present, not to
 * assume anything about the company beyond what's given.
 */

const QUALIFICATION_OUTPUT_SHAPE = `{
  "score": number (0-100),
  "tier": "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED",
  "industryScore": number (0-100),
  "sizeScore": number (0-100),
  "geographyScore": number (0-100),
  "problemScore": number (0-100),
  "decisionMakerScore": number (0-100),
  "buyingSignalScore": number (0-100),
  "reasons": [{ "factor": string, "reasoning": string, "evidenceIds": string[] }],
  "riskFlags": string[]
}`;

export function buildQualificationSystemPrompt(weights: QualificationWeights): string {
  return [
    "You score a researched company against a campaign's Ideal Customer Profile (ICP).",
    "",
    "Rules you must follow:",
    "- Score using ONLY the campaign criteria and research data provided below -- do not assume facts not present.",
    "- Every entry in `reasons` must reference the specific evidence (by its id, from the finding list below)",
    "  that supports it, where evidence exists. If a factor has no supporting evidence (e.g. company size is",
    "  simply unknown), say so in the reasoning and leave evidenceIds empty rather than guessing.",
    `- Weight the six factors as: industryFit ${weights.industryFit * 100}%, companySize ${weights.companySize * 100}%, ` +
      `geographicFit ${weights.geographicFit * 100}%, problemOpportunity ${weights.problemOpportunity * 100}%, ` +
      `decisionMakerFit ${weights.decisionMakerFit * 100}%, buyingSignal ${weights.buyingSignal * 100}%.`,
    "- Overall score must be the weighted sum of the six sub-scores (each sub-score 0-100, weights as above).",
    "- Tier: 80-100 HIGH, 60-79 MEDIUM, 40-59 LOW, 0-39 UNQUALIFIED.",
    "- List any risk flags (e.g. no decision-maker found, very sparse research data) in riskFlags.",
    "- Respond with ONLY a single JSON object matching this exact shape, no other text:",
    QUALIFICATION_OUTPUT_SHAPE,
  ].join("\n");
}

export function buildQualificationUserPrompt(params: {
  campaign: {
    industry: string | null;
    geography: string | null;
    companySize: string | null;
    targetRoles: string[];
    offerDescription: string | null;
  };
  research: ResearchOutput;
  decisionMakers: DecisionMakerOutput;
}): string {
  return [
    "Campaign ICP:",
    JSON.stringify(params.campaign, null, 2),
    "",
    "Company research (each finding has an implicit id = its array index, referenced below as \"finding-<index>\"):",
    JSON.stringify(
      {
        ...params.research,
        findings: params.research.findings.map((f, i) => ({ id: `finding-${i}`, ...f })),
      },
      null,
      2
    ),
    "",
    "Decision-maker candidates found:",
    JSON.stringify(params.decisionMakers, null, 2),
  ].join("\n");
}
