import type { CompanySourcingQuery, SourcedCompanyCandidate, CompanySourcingProvider } from "./types";

// Real, stable, public websites -- NOT invented "*.example.com" subdomains.
// A discovered company gets crawled for real by trigger/research-workflow.ts
// regardless of MOCK_AI/MOCK_SEARCH (see tools/seed-mock-data.ts's identical
// note), so a mock provider returning unresolvable domains would make every
// mock-mode sourcing run dead-end at the research stage. If targetCount
// exceeds this pool, the extra candidates repeat a domain and get skipped by
// the caller's dedupe -- an expected mock limitation, not a bug.
const REAL_MOCK_DOMAINS = [
  { host: "www.iana.org", name: "IANA" },
  { host: "www.mozilla.org", name: "Mozilla" },
  { host: "www.wikimedia.org", name: "Wikimedia Foundation" },
];

/** Deterministic mock, per docs/spec.md §29 (MOCK_SOURCING=true). */
export class MockCompanySourcingProvider implements CompanySourcingProvider {
  readonly name = "mock";

  async findCompanies(query: CompanySourcingQuery): Promise<SourcedCompanyCandidate[]> {
    const count = Math.min(query.targetCount, REAL_MOCK_DOMAINS.length);

    return REAL_MOCK_DOMAINS.slice(0, count).map((entry, i) => ({
      companyName: entry.name,
      website: `https://${entry.host}`,
      industry: query.industry,
      location: query.geography,
      notes: `Matched via mock provider on industry=${query.industry ?? "any"}, geography=${query.geography ?? "any"}`,
      sourceRef: `mock://${entry.host}/${i}`,
      confidence: 0.5,
    }));
  }
}
