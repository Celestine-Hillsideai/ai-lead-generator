import { z } from "zod";

/**
 * Email Generation Agent output contract, per docs/spec.md §17. Word-count
 * target (80-180 words) is a quality guideline the agent's prompt enforces,
 * not a hard Zod constraint -- rejecting a well-written 190-word email as a
 * schema failure would be the wrong kind of strictness. Confidence below the
 * configurable threshold routes the draft to NEEDS_REVIEW (spec §17); that
 * routing decision happens in the agent/orchestrator, not in this schema.
 */

export const emailOutputSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  cta: z.string().min(1),
  personalizationHook: z.string().min(1),
  evidenceIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export type EmailOutput = z.infer<typeof emailOutputSchema>;

export const EMAIL_WORD_COUNT_TARGET = { min: 80, max: 180 } as const;

export function countWords(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}
