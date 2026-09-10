import type { SearchProvider } from "./types";
import { MockSearchProvider } from "./mock";

export type { SearchProvider, DecisionMakerSearchQuery, DecisionMakerSearchResult } from "./types";

/**
 * No real third-party search/contact-data provider is wired up yet (spec
 * §14 leaves the choice open, and the roadmap in spec §37 defers "expanded
 * contact-data providers" to post-MVP). Only MOCK_SEARCH=true is supported
 * today; add a real branch here (mirroring lib/ai/index.ts's pattern) once
 * one is selected.
 */
export function getSearchProvider(): SearchProvider {
  if (process.env.MOCK_SEARCH === "true") {
    return new MockSearchProvider();
  }
  throw new Error(
    "No real SearchProvider is configured yet -- set MOCK_SEARCH=true, or implement and wire up a real provider in lib/search/."
  );
}
