import type { ContactEmailStatus } from "../../types/status";

/**
 * Provider abstraction for third-party search/contact-data services, per
 * docs/spec.md §14: "Create a provider abstraction so public search and
 * third-party data providers can be swapped." No real provider is selected
 * yet -- the Decision-Maker Research Agent's primary source is public
 * team/leadership pages via the crawler (lib/scraper); this interface is
 * the extension point for augmenting that with an approved paid provider
 * later, without changing agent code.
 */

export interface DecisionMakerSearchQuery {
  companyName: string;
  companyDomain: string;
  targetRoles: string[];
}

export interface DecisionMakerSearchResult {
  fullName: string;
  title: string;
  email: string | null;
  emailStatus: ContactEmailStatus;
  sourceUrl: string | null;
  confidence: number;
}

export interface SearchProvider {
  readonly name: string;
  findDecisionMakers(query: DecisionMakerSearchQuery): Promise<DecisionMakerSearchResult[]>;
}
