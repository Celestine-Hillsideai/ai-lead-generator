import type { ResearchFindingOutput } from "../types/contracts";

/**
 * Personalization Agent prompt, per docs/spec.md §16. Input is
 * deliberately narrow -- ONLY campaign config, verified research findings,
 * qualified lead data, and decision-maker info -- matching the spec's
 * explicit restriction on what this agent is allowed to see.
 */

const PERSONALIZATION_OUTPUT_SHAPE = `{
  "openingHook": { "text": string, "evidenceIds": string[] },
  "businessObservation": { "text": string, "evidenceIds": string[] },
  "opportunity": { "text": string, "evidenceIds": string[] },
  "valueConnection": { "text": string, "evidenceIds": string[] },
  "overallConfidence": number (0-1)
}`;

export function buildPersonalizationSystemPrompt(): string {
  return [
    "You write evidence-backed personalization for a B2B outreach email, using only the research findings",
    "provided below.",
    "",
    "Rules you must follow:",
    "- openingHook, businessObservation, and opportunity MUST each cite at least one evidenceId from the",
    "  finding list below (using the exact \"id\" field given for each finding). Never write a claim you",
    "  cannot back with a listed finding.",
    "- Do not convert an INFERENCE or UNKNOWN finding into a stated FACT -- phrase inferences as such",
    "  (e.g. \"it looks like...\", \"this suggests...\") if you use them at all.",
    "- Avoid generic praise (\"impressive company!\") and fake familiarity (\"as we discussed\").",
    "- valueConnection ties the offer/value proposition to the prospect -- it does not need to cite",
    "  evidence, since it's about the sender's offer, not a claim about the company.",
    "- Respond with ONLY a single JSON object matching this exact shape, no other text:",
    PERSONALIZATION_OUTPUT_SHAPE,
  ].join("\n");
}

export function buildPersonalizationUserPrompt(params: {
  campaign: { offerDescription: string | null; valueProposition: string | null; cta: string | null };
  findings: (ResearchFindingOutput & { id: string })[];
  decisionMakerName: string | null;
  decisionMakerTitle: string | null;
}): string {
  return [
    "Campaign offer/value proposition:",
    JSON.stringify(
      {
        offerDescription: params.campaign.offerDescription,
        valueProposition: params.campaign.valueProposition,
        cta: params.campaign.cta,
      },
      null,
      2
    ),
    "",
    `Decision maker: ${params.decisionMakerName ?? "(unknown)"}, ${params.decisionMakerTitle ?? "(unknown title)"}`,
    "",
    "Available verified research findings (cite by \"id\"):",
    JSON.stringify(params.findings, null, 2),
  ].join("\n");
}
