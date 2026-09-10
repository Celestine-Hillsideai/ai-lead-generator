import type { AIProvider } from "../lib/ai/types";
import { generateStructuredOutput } from "../lib/ai/generate-structured";
import {
  qualificationOutputSchema,
  type QualificationOutput,
  type ResearchOutput,
  type DecisionMakerOutput,
  type QualificationWeights,
  DEFAULT_QUALIFICATION_WEIGHTS,
  scoreToTier,
} from "../types/contracts";
import { buildQualificationSystemPrompt, buildQualificationUserPrompt } from "../prompts/qualification.prompt";

export interface RunQualificationAgentInput {
  campaign: {
    industry: string | null;
    geography: string | null;
    companySize: string | null;
    targetRoles: string[];
    offerDescription: string | null;
  };
  research: ResearchOutput;
  decisionMakers: DecisionMakerOutput;
  weights?: QualificationWeights;
}

/**
 * Qualification Agent, per docs/spec.md §15. The model produces the six
 * sub-scores and the evidence-backed reasoning; the overall score and tier
 * are then recomputed deterministically here from the sub-scores and
 * weights, rather than trusted from the model's own arithmetic -- LLM math
 * on a weighted sum is an unnecessary source of error when it's cheap to
 * compute exactly.
 */
export async function runQualificationAgent(
  provider: AIProvider,
  input: RunQualificationAgentInput
): Promise<QualificationOutput> {
  const weights = input.weights ?? DEFAULT_QUALIFICATION_WEIGHTS;

  const modelOutput = await generateStructuredOutput(provider, {
    agentType: "qualification",
    systemPrompt: buildQualificationSystemPrompt(weights),
    userPrompt: buildQualificationUserPrompt({
      campaign: input.campaign,
      research: input.research,
      decisionMakers: input.decisionMakers,
    }),
    schema: qualificationOutputSchema,
    maxTokens: 1500,
  });

  const score =
    modelOutput.industryScore * weights.industryFit +
    modelOutput.sizeScore * weights.companySize +
    modelOutput.geographyScore * weights.geographicFit +
    modelOutput.problemScore * weights.problemOpportunity +
    modelOutput.decisionMakerScore * weights.decisionMakerFit +
    modelOutput.buyingSignalScore * weights.buyingSignal;

  return {
    ...modelOutput,
    score: Math.round(score * 100) / 100,
    tier: scoreToTier(score),
  };
}
