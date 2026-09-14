import type { CompanySourcingProvider } from "./types";
import { MockCompanySourcingProvider } from "./mock";
import { ApolloSourcingProvider } from "./apollo";
import { TavilySourcingProvider } from "./tavily";
import { getAIProvider } from "../ai";

export type { CompanySourcingProvider, CompanySourcingQuery, SourcedCompanyCandidate } from "./types";

/**
 * MOCK_SOURCING is the global kill switch, same pattern as MOCK_EMAIL in
 * lib/email/index.ts -- a real call only happens if MOCK_SOURCING is
 * explicitly not "true" AND SOURCING_API_KEY is present. Deliberately a
 * separate env var/key from MOCK_SEARCH/SEARCH_API_KEY: company-level ICP
 * discovery and person-level lookup-within-a-known-company are different
 * providers/quotas/concerns.
 *
 * SOURCING_PROVIDER picks which real provider that key belongs to.
 * Default "tavily", not "apollo": Apollo's organization-search endpoint
 * requires a paid plan (confirmed via a live 403 against a real Free-plan
 * key, 2026-09-14) and Tavily has a genuinely usable free tier -- see
 * workflows/03-phase-plan.md. Apollo's implementation is complete and
 * tested for whenever a paid Apollo plan (or another user) is available.
 */
export function getCompanySourcingProvider(): CompanySourcingProvider {
  if (process.env.MOCK_SOURCING === "true") {
    return new MockCompanySourcingProvider();
  }

  const apiKey = process.env.SOURCING_API_KEY;
  if (!apiKey) {
    throw new Error("SOURCING_API_KEY is required when MOCK_SOURCING is not true.");
  }

  const providerName = process.env.SOURCING_PROVIDER ?? "tavily";
  if (providerName === "apollo") {
    return new ApolloSourcingProvider(apiKey);
  }
  if (providerName === "tavily") {
    return new TavilySourcingProvider(apiKey, getAIProvider());
  }
  throw new Error(`Unknown SOURCING_PROVIDER "${providerName}" -- expected "apollo" or "tavily".`);
}
