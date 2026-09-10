import { z } from "zod";
import { factTypeSchema } from "../status";

/**
 * Website Research Agent output contract, verbatim structure from
 * docs/spec.md §13. Every factual claim must carry evidence + sourceUrl --
 * this schema is the enforcement point for the non-negotiable "never invent
 * facts" principle (spec §4): an agent response that skips a required field
 * fails validation and triggers the repair/retry path (spec §22), it never
 * silently becomes a stored finding.
 */

export const researchFindingSchema = z.object({
  claim: z.string().min(1),
  evidence: z.string().min(1),
  sourceUrl: z.string().url(),
  category: z.string().min(1),
  factType: factTypeSchema,
  confidence: z.number().min(0).max(1),
});
export type ResearchFindingOutput = z.infer<typeof researchFindingSchema>;

export const leadershipMentionSchema = z.object({
  name: z.string().min(1),
  title: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
});
export type LeadershipMention = z.infer<typeof leadershipMentionSchema>;

export const researchOutputSchema = z.object({
  companySummary: z.string().min(1),
  industry: z.string().nullable(),
  products: z.array(z.string()),
  services: z.array(z.string()),
  locations: z.array(z.string()),
  technologySignals: z.array(z.string()),
  businessSignals: z.array(z.string()),
  potentialOpportunities: z.array(z.string()),
  leadership: z.array(leadershipMentionSchema),
  findings: z.array(researchFindingSchema),
});
export type ResearchOutput = z.infer<typeof researchOutputSchema>;
