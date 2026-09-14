import type { CompanySourcingProvider } from "./types";
import { MockCompanySourcingProvider } from "./mock";
import { ApolloSourcingProvider } from "./apollo";

export type { CompanySourcingProvider, CompanySourcingQuery, SourcedCompanyCandidate } from "./types";

/**
 * Apollo.io is the real provider (spec §11A). MOCK_SOURCING is the global
 * kill switch, same pattern as MOCK_EMAIL in lib/email/index.ts -- a real
 * call only happens if MOCK_SOURCING is explicitly not "true" AND
 * SOURCING_API_KEY is present. Deliberately a separate env var/key from
 * MOCK_SEARCH/SEARCH_API_KEY: company-level ICP discovery and person-level
 * lookup-within-a-known-company are different providers/quotas/concerns.
 */
export function getCompanySourcingProvider(): CompanySourcingProvider {
  if (process.env.MOCK_SOURCING === "true") {
    return new MockCompanySourcingProvider();
  }

  const apiKey = process.env.SOURCING_API_KEY;
  if (!apiKey) {
    throw new Error("SOURCING_API_KEY is required when MOCK_SOURCING is not true.");
  }
  return new ApolloSourcingProvider(apiKey);
}
