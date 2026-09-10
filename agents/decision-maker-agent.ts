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

  return generateStructuredOutput(provider, {
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
}
