import type { AIProvider } from "../lib/ai/types";
import { generateStructuredOutput } from "../lib/ai/generate-structured";
import { researchOutputSchema, type ResearchOutput } from "../types/contracts";
import { buildResearchSystemPrompt, buildResearchUserPrompt } from "../prompts/research.prompt";
import type { CrawledPage } from "../lib/scraper/crawler";

export interface RunResearchAgentInput {
  companyName: string;
  website: string;
  pages: CrawledPage[];
}

/**
 * Website Research Agent, per docs/spec.md §12. Takes already-crawled pages
 * (lib/scraper/crawler.ts's output) -- this module owns the AI extraction
 * step only; the bounded/SSRF-safe crawl itself lives in lib/scraper.
 */
export async function runResearchAgent(
  provider: AIProvider,
  input: RunResearchAgentInput
): Promise<ResearchOutput> {
  if (input.pages.length === 0) {
    throw new Error(`No pages available to research for ${input.companyName} (${input.website})`);
  }

  return generateStructuredOutput(provider, {
    agentType: "research",
    systemPrompt: buildResearchSystemPrompt(),
    userPrompt: buildResearchUserPrompt(input),
    schema: researchOutputSchema,
    maxTokens: 3000,
  });
}
