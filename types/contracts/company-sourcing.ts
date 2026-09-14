import { z } from "zod";

/**
 * Output contract for lib/sourcing/tavily.ts's internal extraction call:
 * given a numbered list of real web-search results, identify which ones are
 * a company's own website (not a directory/listing/news article) and name
 * that company. `resultIndex` ties every candidate back to one specific,
 * real search result -- the caller (lib/sourcing/tavily.ts) builds the
 * candidate's actual website/sourceRef from that result's own URL, never
 * from anything the model writes, so a hallucinated URL is structurally
 * impossible even though this schema alone can't express "index must be in
 * range" (that's a per-call superRefine in tavily.ts, same pattern as
 * personalization's evidenceId check).
 */

export const companySourcingExtractionCandidateSchema = z.object({
  resultIndex: z.number().int().nonnegative(),
  companyName: z.string().min(1),
});

export const companySourcingExtractionOutputSchema = z.object({
  candidates: z.array(companySourcingExtractionCandidateSchema),
});
export type CompanySourcingExtractionOutput = z.infer<typeof companySourcingExtractionOutputSchema>;

/**
 * Second-stage output: given a flat, numbered list of web-search results
 * gathered from per-company "<name> official website"-style searches (real
 * search results, never company-search results directly used as the final
 * site -- see lib/sourcing/tavily.ts), pick which single result (if any) is
 * each named company's own official site. `resultIndex` ties every
 * resolution back to one real, already-fetched result -- same "index into
 * real data, never a model-written URL" discipline as the extraction stage.
 * A company with no good match is simply omitted, not forced.
 */
export const companySourcingResolutionEntrySchema = z.object({
  companyName: z.string().min(1),
  resultIndex: z.number().int().nonnegative(),
});

export const companySourcingResolutionOutputSchema = z.object({
  resolutions: z.array(companySourcingResolutionEntrySchema),
});
export type CompanySourcingResolutionOutput = z.infer<typeof companySourcingResolutionOutputSchema>;
