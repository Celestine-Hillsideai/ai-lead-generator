import type { SearchProvider } from "./types";
import { MockSearchProvider } from "./mock";
import { TavilySearchProvider } from "./tavily";
import { getAIProvider } from "../ai";

export type { SearchProvider, DecisionMakerSearchQuery, DecisionMakerSearchResult } from "./types";

/**
 * MOCK_SEARCH is the global kill switch, same pattern as MOCK_EMAIL/
 * MOCK_SOURCING -- a real call only happens if MOCK_SEARCH is explicitly not
 * "true" AND SEARCH_API_KEY is present. Real provider: Tavily
 * (lib/search/tavily.ts), the same web-search API lib/sourcing/tavily.ts
 * uses for company sourcing -- a separate env var/key on purpose (company-
 * level ICP discovery and person-level lookup within an already-known
 * company are different concerns/quotas even when the underlying account
 * happens to be the same Tavily account today).
 */
export function getSearchProvider(): SearchProvider {
  if (process.env.MOCK_SEARCH === "true") {
    return new MockSearchProvider();
  }

  const apiKey = process.env.SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error("SEARCH_API_KEY is required when MOCK_SEARCH is not true.");
  }
  return new TavilySearchProvider(apiKey, getAIProvider());
}
