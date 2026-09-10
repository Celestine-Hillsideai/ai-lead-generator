import { z } from "zod";
import type { AIProvider } from "../lib/ai/types";
import { generateStructuredOutput } from "../lib/ai/generate-structured";
import { emailOutputSchema, type EmailOutput, type PersonalizationOutput, collectEvidenceIds } from "../types/contracts";
import { buildEmailSystemPrompt, buildEmailUserPrompt } from "../prompts/email.prompt";

export interface RunEmailAgentInput {
  campaign: {
    offerDescription: string | null;
    valueProposition: string | null;
    cta: string | null;
    researchInstructions: string | null;
  };
  personalization: PersonalizationOutput;
  recipientFirstName: string | null;
}

/** Default routing threshold, per docs/spec.md §17 -- configurable in Settings (future frontend). */
export const DEFAULT_EMAIL_CONFIDENCE_THRESHOLD = 0.6;

export function needsReview(confidence: number, threshold = DEFAULT_EMAIL_CONFIDENCE_THRESHOLD): boolean {
  return confidence < threshold;
}

/**
 * Email Generation Agent, per docs/spec.md §17. Like the personalization
 * agent, evidenceIds are validated against the actual evidence the
 * personalization step provided -- the email can't cite evidence that
 * wasn't part of its own personalization material.
 */
export async function runEmailAgent(provider: AIProvider, input: RunEmailAgentInput): Promise<EmailOutput> {
  const validEvidenceIds = new Set(collectEvidenceIds(input.personalization));

  const schemaWithEvidenceCheck = emailOutputSchema.superRefine((output, ctx) => {
    for (const id of output.evidenceIds) {
      if (!validEvidenceIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `evidenceId "${id}" was not part of the provided personalization material`,
        });
      }
    }
  });

  return generateStructuredOutput(provider, {
    agentType: "email",
    systemPrompt: buildEmailSystemPrompt(),
    userPrompt: buildEmailUserPrompt(input),
    schema: schemaWithEvidenceCheck,
    maxTokens: 1000,
  });
}
