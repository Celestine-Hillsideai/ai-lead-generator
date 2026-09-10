import type { PersonalizationOutput } from "../types/contracts";
import { EMAIL_WORD_COUNT_TARGET } from "../types/contracts";

/** Email Generation Agent prompt, per docs/spec.md §17. */

const EMAIL_OUTPUT_SHAPE = `{
  "subject": string,
  "body": string,
  "cta": string,
  "personalizationHook": string,
  "evidenceIds": string[],
  "confidence": number (0-1)
}`;

export function buildEmailSystemPrompt(): string {
  return [
    "You write a concise, professional, conversational cold outreach email from the personalization",
    "material provided below.",
    "",
    "Rules you must follow:",
    `- Target ${EMAIL_WORD_COUNT_TARGET.min}-${EMAIL_WORD_COUNT_TARGET.max} words for the body, unless the campaign's own instructions say otherwise.`,
    "- Use exactly one clear call to action, based on the campaign's CTA.",
    "- No hype, no unsupported statistics, no false urgency, no deceptive claims, no spammy phrasing.",
    "- Ground the email in the opening hook, business observation, and opportunity provided -- don't",
    "  introduce new claims about the company that weren't in that material.",
    "- evidenceIds in your response should be the union of all evidenceIds from the personalization",
    "  material you actually used in the email body.",
    "- personalizationHook should be a short (under 10 words) label summarizing what made this email",
    "  specific to this prospect.",
    "- confidence should reflect how well-supported and specific the email actually is -- lower it if the",
    "  personalization material was thin.",
    "- Respond with ONLY a single JSON object matching this exact shape, no other text:",
    EMAIL_OUTPUT_SHAPE,
  ].join("\n");
}

export function buildEmailUserPrompt(params: {
  campaign: {
    offerDescription: string | null;
    valueProposition: string | null;
    cta: string | null;
    researchInstructions: string | null;
  };
  personalization: PersonalizationOutput;
  recipientFirstName: string | null;
}): string {
  return [
    "Campaign offer/value proposition/CTA:",
    JSON.stringify(
      {
        offerDescription: params.campaign.offerDescription,
        valueProposition: params.campaign.valueProposition,
        cta: params.campaign.cta,
      },
      null,
      2
    ),
    params.campaign.researchInstructions
      ? `\nAdditional campaign instructions: ${params.campaign.researchInstructions}`
      : "",
    "",
    `Recipient first name: ${params.recipientFirstName ?? "(unknown -- use a neutral greeting)"}`,
    "",
    "Personalization material (already evidence-backed -- use it, don't re-derive claims):",
    JSON.stringify(params.personalization, null, 2),
  ].join("\n");
}
