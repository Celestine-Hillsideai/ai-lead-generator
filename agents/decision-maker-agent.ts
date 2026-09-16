import type { AIProvider } from "../lib/ai/types";
import { generateStructuredOutput } from "../lib/ai/generate-structured";
import { decisionMakerOutputSchema, type DecisionMakerCandidate, type DecisionMakerOutput } from "../types/contracts";
import { buildDecisionMakerSystemPrompt, buildDecisionMakerUserPrompt } from "../prompts/decision-maker.prompt";
import type { CrawledPage } from "../lib/scraper/crawler";
import type { DecisionMakerSearchResult, SearchProvider } from "../lib/search/types";

export interface RunDecisionMakerAgentInput {
  companyName: string;
  companyDomain: string;
  targetRoles: string[];
  /** Team/leadership-relevant pages from the same crawl the research agent used, or a fresh targeted crawl. */
  pages: CrawledPage[];
}

/**
 * Splits an already-known real fullName into firstName/lastName -- not a
 * guess about the person, just parsing structure out of a string the model
 * (or lib/search/tavily.ts's own extraction) already grounded in real
 * content. Used as a deterministic fallback for whenever the model leaves
 * firstName/lastName null despite providing fullName, which email
 * personalization (agents/email-agent.ts's recipientFirstName) depends on
 * for a real salutation instead of a generic "Hi there" greeting.
 */
export function splitFullName(fullName: string): { firstName: string | null; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: null };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

/**
 * Honorifics/titles that show up glued to a real name (from a company's own
 * "About"/"Board" page, or occasionally a crawler text-extraction artifact
 * like "Button Engr. ...") but aren't part of the name itself -- stripped
 * before matching so they don't block a real match on the actual name.
 */
const NAME_TITLE_WORDS = new Set([
  "dr", "chief", "engr", "alhaji", "alhaja", "prince", "princess", "sir", "mr", "mrs", "ms",
  "hon", "rev", "professor", "prof", "cfr", "con", "otunba", "oba", "button",
]);

function nameTokens(fullName: string): string[] {
  return fullName
    .toLowerCase()
    .replace(/[()'".,]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !NAME_TITLE_WORDS.has(t));
}

/**
 * True if `result` plausibly describes the same person as `candidate`, even
 * when the two sources spell/format the name differently -- e.g. a
 * company's own board page says "Nasiru A. Dantata" while Hunter.io returns
 * the same person with no name at all, just nasiru.dantata@company.com.
 * Requires the FULL first-name token (not just its initial) and the
 * surname to both appear in the email's local part -- an initial-based
 * fallback ("m" for both Mubarak and Muktar) was tried and, in live
 * testing against this exact real company, cross-matched a different
 * person who shares a surname AND a first initial ("Alhaji Mubarak A.
 * Dantata" incorrectly got "Muktar Dantata"'s real email). Attaching a real
 * email to the wrong real person is worse than leaving it unknown, so this
 * only matches when both name tokens are unambiguously present.
 */
function namesLikelyMatch(candidateFullName: string, result: DecisionMakerSearchResult): boolean {
  if (candidateFullName.trim().toLowerCase() === result.fullName.trim().toLowerCase()) return true;
  if (!result.email) return false;

  const localPart = result.email.split("@")[0]!.toLowerCase();
  const tokens = nameTokens(candidateFullName);
  if (tokens.length < 2) return false;

  const first = tokens[0]!;
  const last = tokens[tokens.length - 1]!;
  if (last.length < 3 || first.length < 3) return false; // too short/ambiguous to trust as a discriminator

  return localPart.includes(first) && localPart.includes(last);
}

/**
 * Self-heals a candidate's email/emailStatus/sourceUrl from the real
 * SearchProvider record it corresponds to, if one can be identified --
 * guards against the model subtly altering a real, verified email (e.g.
 * from lib/search/hunter.ts) while copying it through its own synthesis
 * pass. This matters now that a real verified email actually gets used for
 * sending (app/actions/emails.ts), not just displayed -- a
 * corrupted-but-plausible-looking email is worse than one correctly labeled
 * "unknown". Candidates with no matching search record (e.g. found only on
 * a crawled page, or a company Hunter/Tavily genuinely has no data on) are
 * left as the model reported, governed by the existing prompt-only
 * discipline for that case.
 */
function reconcileWithSearchResults(
  candidate: DecisionMakerCandidate,
  searchResults: DecisionMakerSearchResult[]
): DecisionMakerCandidate {
  const match =
    (candidate.sourceUrl ? searchResults.find((r) => r.sourceUrl === candidate.sourceUrl) : undefined) ??
    searchResults.find((r) => namesLikelyMatch(candidate.fullName, r));

  if (!match) return candidate;

  return { ...candidate, email: match.email, emailStatus: match.emailStatus, sourceUrl: match.sourceUrl };
}

/**
 * Decision-Maker Research Agent, per docs/spec.md §14. Checks public
 * pages first (via the caller-supplied `pages`), then augments with a
 * configured SearchProvider if one is available.
 */
export async function runDecisionMakerAgent(
  provider: AIProvider,
  searchProvider: SearchProvider,
  input: RunDecisionMakerAgentInput
): Promise<DecisionMakerOutput> {
  const searchResults = await searchProvider.findDecisionMakers({
    companyName: input.companyName,
    companyDomain: input.companyDomain,
    targetRoles: input.targetRoles,
  });

  const output = await generateStructuredOutput(provider, {
    agentType: "decision_maker",
    systemPrompt: buildDecisionMakerSystemPrompt(),
    userPrompt: buildDecisionMakerUserPrompt({
      companyName: input.companyName,
      targetRoles: input.targetRoles,
      pages: input.pages,
      searchResults,
    }),
    schema: decisionMakerOutputSchema,
    maxTokens: 2000,
  });

  return {
    candidates: output.candidates.map((raw) => {
      const c = reconcileWithSearchResults(raw, searchResults);
      if (c.firstName) return c; // model already split it; don't override
      const { firstName, lastName } = splitFullName(c.fullName);
      return { ...c, firstName, lastName: c.lastName ?? lastName };
    }),
  };
}
