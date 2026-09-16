import type { DecisionMakerSearchQuery, DecisionMakerSearchResult, SearchProvider } from "./types";
import { MockSearchProvider } from "./mock";
import { TavilySearchProvider } from "./tavily";
import { HunterSearchProvider } from "./hunter";
import { getAIProvider } from "../ai";

export type { SearchProvider, DecisionMakerSearchQuery, DecisionMakerSearchResult } from "./types";

/**
 * Tries `primary` first; if it returns zero candidates (nothing found, not
 * an error -- an error still propagates), falls back to `secondary`. Used to
 * combine Hunter.io (structured, real emails, but only covers domains in its
 * own database) with Tavily (broader web search, real names but rarely a
 * real email) -- see workflows/03-phase-plan.md's 2026-09-16 note on why a
 * Tavily-only result was contact-less too often to be useful.
 */
export class FallbackSearchProvider implements SearchProvider {
  readonly name: string;

  constructor(
    private readonly primary: SearchProvider,
    private readonly secondary: SearchProvider
  ) {
    this.name = `${primary.name}+${secondary.name}`;
  }

  async findDecisionMakers(query: DecisionMakerSearchQuery): Promise<DecisionMakerSearchResult[]> {
    const primaryResults = await this.primary.findDecisionMakers(query);
    if (primaryResults.length > 0) return primaryResults;
    return this.secondary.findDecisionMakers(query);
  }
}

/**
 * MOCK_SEARCH is the global kill switch, same pattern as MOCK_EMAIL/
 * MOCK_SOURCING -- a real call only happens if MOCK_SEARCH is explicitly not
 * "true". Real providers, tried in order:
 *   1. Hunter.io (lib/search/hunter.ts) -- structured, no AI step, and the
 *      only source of a genuinely verified email; requires HUNTER_API_KEY.
 *   2. Tavily (lib/search/tavily.ts) -- broader web search + AI extraction,
 *      used only when Hunter finds nothing for a domain (its free tier
 *      doesn't cover every company); requires SEARCH_API_KEY. Optional --
 *      if unset, Hunter runs alone with no fallback.
 * Both are separate env vars/keys on purpose (different providers/quotas),
 * even though SEARCH_API_KEY happens to hold the same Tavily account
 * lib/sourcing/tavily.ts (SOURCING_API_KEY) uses today.
 */
export function getSearchProvider(): SearchProvider {
  if (process.env.MOCK_SEARCH === "true") {
    return new MockSearchProvider();
  }

  const hunterKey = process.env.HUNTER_API_KEY;
  if (!hunterKey) {
    throw new Error("HUNTER_API_KEY is required when MOCK_SEARCH is not true.");
  }
  const hunter = new HunterSearchProvider(hunterKey);

  const tavilyKey = process.env.SEARCH_API_KEY;
  if (!tavilyKey) return hunter;

  return new FallbackSearchProvider(hunter, new TavilySearchProvider(tavilyKey, getAIProvider()));
}
