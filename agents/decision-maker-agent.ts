import type { AIProvider } from "../lib/ai/types";
import { generateStructuredOutput } from "../lib/ai/generate-structured";
import { decisionMakerOutputSchema, type DecisionMakerOutput } from "../types/contracts";
import { buildDecisionMakerSystemPrompt, buildDecisionMakerUserPrompt } from "../prompts/decision-maker.prompt";
import type { CrawledPage } from "../lib/scraper/crawler";
import type { SearchProvider } from "../lib/search/types";

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
    candidates: output.candidates.map((c) => {
      if (c.firstName) return c; // model already split it; don't override
      const { firstName, lastName } = splitFullName(c.fullName);
      return { ...c, firstName, lastName: c.lastName ?? lastName };
    }),
  };
}
