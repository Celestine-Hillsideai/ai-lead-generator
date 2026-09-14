import { z } from "zod";

/**
 * Output contract for lib/search/tavily.ts's internal extraction call:
 * given a numbered list of real web-search results for a company, identify
 * any real, named decision-maker mentioned and their title. `resultIndex`
 * ties every candidate back to one specific, real search result -- the
 * caller (lib/search/tavily.ts) builds the candidate's sourceUrl from that
 * real result, never from anything the model writes. `email` is optional
 * and, per spec §4 ("never fabricate or guess email addresses"), is only
 * kept by the caller if it's found verbatim in that same result's content --
 * never constructed from a name+domain pattern, even though that's a common
 * (but explicitly prohibited) guessing heuristic.
 */

export const decisionMakerSearchExtractionCandidateSchema = z.object({
  resultIndex: z.number().int().nonnegative(),
  fullName: z.string().min(1),
  title: z.string().min(1),
  /** Only set if an email address literally appears in the result's content -- never invented. Re-verified against the real result by lib/search/tavily.ts before use. */
  email: z.string().email().nullable(),
});

export const decisionMakerSearchExtractionOutputSchema = z.object({
  candidates: z.array(decisionMakerSearchExtractionCandidateSchema),
});
export type DecisionMakerSearchExtractionOutput = z.infer<typeof decisionMakerSearchExtractionOutputSchema>;
