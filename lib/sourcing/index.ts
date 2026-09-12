import type { CompanySourcingProvider } from "./types";
import { MockCompanySourcingProvider } from "./mock";

export type { CompanySourcingProvider, CompanySourcingQuery, SourcedCompanyCandidate } from "./types";

/**
 * No real company-sourcing provider (Apollo.io, Clay, etc.) is wired up yet
 * -- same situation as lib/search/index.ts for the decision-maker provider.
 * Only MOCK_SOURCING=true is supported today; add a real branch here once
 * one is selected. Deliberately a separate env var/key from
 * MOCK_SEARCH/SEARCH_API_KEY: company-level ICP discovery and person-level
 * lookup-within-a-known-company are different providers/quotas/concerns.
 */
export function getCompanySourcingProvider(): CompanySourcingProvider {
  if (process.env.MOCK_SOURCING === "true") {
    return new MockCompanySourcingProvider();
  }
  throw new Error(
    "No real CompanySourcingProvider is configured yet -- set MOCK_SOURCING=true, or implement and wire up a real provider in lib/sourcing/."
  );
}
