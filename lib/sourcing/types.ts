/**
 * Company-sourcing provider abstraction, per docs/spec.md §11A: discovers
 * companies matching a campaign's ICP so a campaign's lead list can be
 * populated without a CSV upload. Mirrors lib/search/types.ts's shape.
 *
 * Every SourcedCompanyCandidate carries a `sourceRef` pointing back to the
 * provider's own result -- this is how "never invent facts" (CLAUDE.md,
 * spec §4) is satisfied structurally here: a candidate's name/website
 * traces to the provider's response, never to a model's free-text output.
 */

export interface CompanySourcingQuery {
  industry: string | null;
  geography: string | null;
  companySize: string | null;
  targetRoles: string[];
  offerDescription: string | null;
  /** Already clamped by the caller against campaign/settings caps before this is built. */
  targetCount: number;
}

export interface SourcedCompanyCandidate {
  companyName: string;
  website: string;
  industry: string | null;
  location: string | null;
  notes: string | null;
  /** Opaque pointer back to the provider's own result for this candidate (a URL, an external id, etc.). */
  sourceRef: string;
  confidence: number;
}

export interface CompanySourcingProvider {
  readonly name: string;
  findCompanies(query: CompanySourcingQuery): Promise<SourcedCompanyCandidate[]>;
}
