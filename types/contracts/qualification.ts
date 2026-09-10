import { z } from "zod";
import { qualificationTierSchema } from "../status";

/** Default ICP scoring weights, per docs/spec.md §15. Configurable in Settings (future frontend). */
export const DEFAULT_QUALIFICATION_WEIGHTS = {
  industryFit: 0.25,
  companySize: 0.15,
  geographicFit: 0.1,
  problemOpportunity: 0.25,
  decisionMakerFit: 0.15,
  buyingSignal: 0.1,
} as const;

export const qualificationWeightsSchema = z.object({
  industryFit: z.number().min(0).max(1),
  companySize: z.number().min(0).max(1),
  geographicFit: z.number().min(0).max(1),
  problemOpportunity: z.number().min(0).max(1),
  decisionMakerFit: z.number().min(0).max(1),
  buyingSignal: z.number().min(0).max(1),
});
export type QualificationWeights = z.infer<typeof qualificationWeightsSchema>;

/** Score-to-tier boundaries, per spec §15. */
export function scoreToTier(score: number): z.infer<typeof qualificationTierSchema> {
  if (score >= 80) return "HIGH";
  if (score >= 60) return "MEDIUM";
  if (score >= 40) return "LOW";
  return "UNQUALIFIED";
}

export const qualificationReasonSchema = z.object({
  factor: z.string().min(1),
  reasoning: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
});
export type QualificationReason = z.infer<typeof qualificationReasonSchema>;

/**
 * Qualification Agent output contract, per docs/spec.md §15. "All score
 * reasons must reference available evidence" -- reasons carry evidenceIds
 * (possibly empty for non-evidence-based factors like company size, but the
 * agent prompt requires citing evidence wherever it exists).
 */
export const qualificationOutputSchema = z.object({
  score: z.number().min(0).max(100),
  tier: qualificationTierSchema,
  industryScore: z.number().min(0).max(100),
  sizeScore: z.number().min(0).max(100),
  geographyScore: z.number().min(0).max(100),
  problemScore: z.number().min(0).max(100),
  decisionMakerScore: z.number().min(0).max(100),
  buyingSignalScore: z.number().min(0).max(100),
  reasons: z.array(qualificationReasonSchema),
  riskFlags: z.array(z.string()),
});
export type QualificationOutput = z.infer<typeof qualificationOutputSchema>;
