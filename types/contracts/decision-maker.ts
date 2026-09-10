import { z } from "zod";
import { contactEmailStatusSchema } from "../status";

/**
 * Decision-Maker Research Agent output contract, per docs/spec.md §14. The
 * spec doesn't give a literal JSON shape (unlike research/qualification/
 * email), so this is derived from the Contact entity plus the explicit
 * requirements: rank by relevance, never fabricate, distinguish email
 * verification status.
 */

export const decisionMakerCandidateSchema = z.object({
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  fullName: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email().nullable(),
  emailStatus: contactEmailStatusSchema,
  sourceUrl: z.string().url().nullable(),
  confidence: z.number().min(0).max(1),
  relevanceReason: z.string().min(1),
});
export type DecisionMakerCandidate = z.infer<typeof decisionMakerCandidateSchema>;

export const decisionMakerOutputSchema = z.object({
  candidates: z.array(decisionMakerCandidateSchema),
});
export type DecisionMakerOutput = z.infer<typeof decisionMakerOutputSchema>;

/** Priority order for ranking, per spec §14. Lower index = higher priority. */
export const DECISION_MAKER_ROLE_PRIORITY: readonly string[] = [
  "CEO",
  "Founder",
  "Managing Director",
  "COO",
  "CTO",
  "CIO",
  "Head of Operations",
  "Head of Digital Transformation",
  "Head of Innovation",
];
