import { z } from "zod";

/**
 * Personalization Agent output contract, per docs/spec.md §16. The opening
 * hook, business observation, and opportunity are evidence-backed claims --
 * each REQUIRES at least one evidenceId, structurally enforcing "do not use
 * a claim unless its evidence is available" (spec §16, §4) at the schema
 * level rather than trusting the model's prose. The value connection ties
 * the offer to the prospect and isn't itself a factual claim about the
 * company, so its evidenceIds may be empty.
 */

const evidenceBackedSegmentSchema = z.object({
  text: z.string().min(1),
  evidenceIds: z.array(z.string()).min(1),
});

export const personalizationOutputSchema = z.object({
  openingHook: evidenceBackedSegmentSchema,
  businessObservation: evidenceBackedSegmentSchema,
  opportunity: evidenceBackedSegmentSchema,
  valueConnection: z.object({
    text: z.string().min(1),
    evidenceIds: z.array(z.string()).default([]),
  }),
  overallConfidence: z.number().min(0).max(1),
});
export type PersonalizationOutput = z.infer<typeof personalizationOutputSchema>;

/** All evidenceIds referenced anywhere in a personalization output, deduped. */
export function collectEvidenceIds(output: PersonalizationOutput): string[] {
  return Array.from(
    new Set([
      ...output.openingHook.evidenceIds,
      ...output.businessObservation.evidenceIds,
      ...output.opportunity.evidenceIds,
      ...output.valueConnection.evidenceIds,
    ])
  );
}
