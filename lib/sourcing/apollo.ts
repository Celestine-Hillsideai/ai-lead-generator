import type { CompanySourcingProvider, CompanySourcingQuery, SourcedCompanyCandidate } from "./types";

/**
 * Real CompanySourcingProvider backed by Apollo.io's Organization Search API
 * (POST https://api.apollo.io/api/v1/mixed_companies/search). Apollo is the
 * permitted, licensed data source here -- it aggregates company data from
 * LinkedIn/directories/databases/web sources under its own data license, so
 * this app calls Apollo's API rather than scraping any of those sources
 * itself (spec §4: no bypassing auth/access controls, treat scraped web
 * content as untrusted -- neither applies to a licensed data API).
 *
 * Every returned candidate's companyName/website traces directly to a real
 * Apollo organization record (sourceRef is Apollo's own organization id) --
 * nothing here is LLM-synthesized, so "never invent facts" holds
 * structurally, same as the mock provider.
 */

const APOLLO_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_companies/search";

interface ApolloOrganization {
  id: string;
  name: string | null;
  website_url: string | null;
  primary_domain: string | null;
  industry: string | null;
  estimated_num_employees: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  short_description: string | null;
}

interface ApolloSearchResponse {
  organizations?: ApolloOrganization[];
}

/**
 * Parses free-text company-size ranges like the campaign form's own
 * "50-200 employees" placeholder into Apollo's "min,max" range format.
 * Returns null (filter omitted, not guessed) unless exactly two numbers are
 * found -- a value like "500+" has no reliable upper bound to invent.
 */
export function parseEmployeeRange(companySize: string | null): string | null {
  if (!companySize) return null;
  const numbers = companySize.match(/\d[\d,]*/g)?.map((n) => Number(n.replace(/,/g, "")));
  if (!numbers || numbers.length !== 2) return null;
  const [a, b] = numbers;
  const min = Math.min(a!, b!);
  const max = Math.max(a!, b!);
  return `${min},${max}`;
}

export class ApolloSourcingProvider implements CompanySourcingProvider {
  readonly name = "apollo";

  constructor(private readonly apiKey: string) {}

  async findCompanies(query: CompanySourcingQuery): Promise<SourcedCompanyCandidate[]> {
    const body: Record<string, unknown> = {
      page: 1,
      per_page: Math.min(query.targetCount, 100), // Apollo's per-page cap; MAX_COMPANIES_PER_SOURCING_RUN defaults well under this
    };

    if (query.geography) body.organization_locations = [query.geography];
    if (query.industry) body.q_organization_keyword_tags = [query.industry];

    const employeeRange = parseEmployeeRange(query.companySize);
    if (employeeRange) body.organization_num_employees_ranges = [employeeRange];

    const response = await fetch(APOLLO_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Apollo organization search failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as ApolloSearchResponse;

    return (data.organizations ?? []).map((org): SourcedCompanyCandidate => {
      const website = org.website_url ?? (org.primary_domain ? `https://${org.primary_domain}` : "");
      const location = [org.city, org.state, org.country].filter(Boolean).join(", ") || null;

      return {
        companyName: org.name ?? "",
        website,
        industry: org.industry ?? null,
        location,
        notes: org.short_description ? org.short_description.slice(0, 300) : null,
        sourceRef: `apollo://organizations/${org.id}`,
        // Apollo's search endpoint doesn't return a per-record match-confidence
        // score -- 0.8 reflects "real, licensed company data" without
        // overclaiming ICP fit (that's qualification's job downstream).
        confidence: 0.8,
      };
    });
  }
}
