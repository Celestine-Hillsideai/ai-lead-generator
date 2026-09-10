import { z } from "zod";
import type { AIProvider } from "../lib/ai/types";
import { generateStructuredOutput } from "../lib/ai/generate-structured";
import {
  personalizationOutputSchema,
  type PersonalizationOutput,
  type ResearchFindingOutput,
  collectEvidenceIds,
} from "../types/contracts";
import { buildPersonalizationSystemPrompt, buildPersonalizationUserPrompt } from "../prompts/personalization.prompt";

export interface RunPersonalizationAgentInput {
  campaign: { offerDescription: string | null; valueProposition: string | null; cta: string | null };
  /** Verified findings this lead qualified on, with their real (already-persisted) evidence IDs. */
  findings: (ResearchFindingOutput & { id: string })[];
  decisionMakerName: string | null;
  decisionMakerTitle: string | null;
}

/**
 * Personalization Agent, per docs/spec.md §16. Every evidenceId the model
 * references is validated against the actual set of findings it was given
 * -- not just "is this a string", but "does this finding id really exist"
 * -- by building a schema refinement per call, so a hallucinated evidence
 * id fails validation and triggers the repair-retry loop rather than
 * silently passing through as a broken reference.
 */
export async function runPersonalizationAgent(
  provider: AIProvider,
  input: RunPersonalizationAgentInput
): Promise<PersonalizationOutput> {
  if (input.findings.length === 0) {
    throw new Error("Personalization Agent requires at least one verified research finding.");
  }

  const validFindingIds = new Set(input.findings.map((f) => f.id));

  const schemaWithEvidenceCheck = personalizationOutputSchema.superRefine((output, ctx) => {
    for (const id of collectEvidenceIds(output)) {
      if (!validFindingIds.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `evidenceId "${id}" does not match any provided finding id`,
        });
      }
    }
  });

  return generateStructuredOutput(provider, {
    agentType: "personalization",
    systemPrompt: buildPersonalizationSystemPrompt(),
    userPrompt: buildPersonalizationUserPrompt({
      campaign: input.campaign,
      findings: input.findings,
      decisionMakerName: input.decisionMakerName,
      decisionMakerTitle: input.decisionMakerTitle,
    }),
    schema: schemaWithEvidenceCheck,
    maxTokens: 1500,
  });
}
