import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { generateStructuredOutput } from "../ai/generate-structured";
import { companySourcingExtractionOutputSchema, companySourcingResolutionOutputSchema } from "../../types/contracts";
import {
  buildCompanySourcingSystemPrompt,
  buildCompanySourcingUserPrompt,
  buildCompanyDomainResolutionSystemPrompt,
  buildCompanyDomainResolutionUserPrompt,
  type CompanySourcingSearchResult,
} from "../../prompts/company-sourcing.prompt";
import type { CompanySourcingProvider, CompanySourcingQuery, SourcedCompanyCandidate } from "./types";

/**
 * Real CompanySourcingProvider backed by Tavily's web-search API (a free
 * tier is actually usable for this, unlike Apollo.io's organization-search
 * endpoint -- see workflows/03-phase-plan.md's 2026-09-14 note).
 *
 * Two-stage design, not one search + one extraction -- confirmed live
 * (2026-09-14) that a single "companies in X industry" search only ever
 * surfaces "Top N companies" listicle/directory pages, never individual
 * company homepages, and that even a targeted "<name> official website"
 * search frequently ranks LinkedIn/app-store/Wikipedia/Crunchbase pages
 * above (or instead of) the company's real domain:
 *   1. Discovery search (broad ICP query) -> AI extraction identifies real
 *      company NAMES actually named in those results (grounded by
 *      resultIndex into the real results, so a hallucinated company is
 *      structurally rejected).
 *   2. Per extracted name, a targeted "<name> official website" search
 *      (with a denylist of known non-company-owned domains excluded) -> a
 *      second AI call picks, per company, which one (if any) of ITS OWN
 *      small result set is genuinely that company's official site.
 * In both stages the model only ever returns an index into real,
 * already-fetched results (validated in-range via a per-call superRefine,
 * same idiom agents/personalization-agent.ts uses for evidenceIds) -- every
 * candidate's actual website/sourceRef is built from that real result,
 * never from a URL the model writes. A company with no good resolution is
 * simply dropped, never forced to a weak guess.
 */

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

// Common domains that rank highly for "<company> official website" searches
// but are never the company's own site -- excluded server-side so Tavily's
// top results are actually candidates worth asking the model about.
const RESOLUTION_EXCLUDE_DOMAINS = [
  "linkedin.com",
  "wikipedia.org",
  "en.wikipedia.org",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "apps.apple.com",
  "play.google.com",
  "trustpilot.com",
  "bloomberg.com",
  "crunchbase.com",
  "pitchbook.com",
  "glassdoor.com",
  "indeed.com",
  "medium.com",
  "reddit.com",
  "quora.com",
  "leadiq.com",
];

interface TavilySearchResponse {
  results?: TavilySearchResultItem[];
}
interface TavilySearchResultItem {
  title: string;
  url: string;
  content: string;
}

function buildIcpQuery(query: CompanySourcingQuery): string {
  const parts: string[] = ["top companies"];
  if (query.industry) parts.push(`in the ${query.industry} industry`);
  if (query.geography) parts.push(`in ${query.geography}`);
  if (query.companySize) parts.push(`(${query.companySize})`);
  return parts.join(" ");
}

function buildIcpDescription(query: CompanySourcingQuery): string {
  return (
    [
      query.industry ? `Industry: ${query.industry}` : null,
      query.geography ? `Geography: ${query.geography}` : null,
      query.companySize ? `Company size: ${query.companySize}` : null,
      query.targetRoles.length > 0 ? `Buyer roles: ${query.targetRoles.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join(". ") || "No specific ICP criteria provided."
  );
}

export class TavilySourcingProvider implements CompanySourcingProvider {
  readonly name = "tavily";

  constructor(
    private readonly apiKey: string,
    private readonly aiProvider: AIProvider
  ) {}

  private async search(query: string, opts: { maxResults: number; excludeDomains?: string[] }): Promise<TavilySearchResultItem[]> {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: opts.maxResults,
        ...(opts.excludeDomains ? { exclude_domains: opts.excludeDomains } : {}),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Tavily search failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as TavilySearchResponse;
    return data.results ?? [];
  }

  async findCompanies(query: CompanySourcingQuery): Promise<SourcedCompanyCandidate[]> {
    // --- Stage 1: discover real company names ---
    const discoveryResults = await this.search(buildIcpQuery(query), { maxResults: 10 });
    if (discoveryResults.length === 0) return [];

    const extractionSchema = companySourcingExtractionOutputSchema.superRefine((output, ctx) => {
      for (const c of output.candidates) {
        if (c.resultIndex >= discoveryResults.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `resultIndex ${c.resultIndex} is out of range for ${discoveryResults.length} provided result(s)`,
          });
        }
      }
    });

    const extraction = await generateStructuredOutput(this.aiProvider, {
      agentType: "company_sourcing",
      systemPrompt: buildCompanySourcingSystemPrompt(),
      userPrompt: buildCompanySourcingUserPrompt({
        icpDescription: buildIcpDescription(query),
        results: discoveryResults,
      }),
      schema: extractionSchema,
      maxTokens: 1500,
    });

    const seenNames = new Set<string>();
    const extractedNames: string[] = [];
    for (const c of extraction.candidates) {
      const key = c.companyName.trim().toLowerCase();
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);
      extractedNames.push(c.companyName.trim());
      if (extractedNames.length >= query.targetCount) break;
    }
    if (extractedNames.length === 0) return [];

    // --- Stage 2: resolve each name to its real official site ---
    const perCompanyResults = await Promise.all(
      extractedNames.map((name) => this.search(`"${name}" official website`, { maxResults: 5, excludeDomains: RESOLUTION_EXCLUDE_DOMAINS }))
    );

    // Flat global index -> real result, mirroring prompts/company-sourcing.prompt.ts's buildCompanyDomainResolutionUserPrompt numbering.
    const flatResults: TavilySearchResultItem[] = [];
    const rangeByCompany = new Map<string, { start: number; end: number }>();
    const companiesForPrompt: { companyName: string; results: CompanySourcingSearchResult[] }[] = [];
    for (let i = 0; i < extractedNames.length; i++) {
      const name = extractedNames[i]!;
      const results = perCompanyResults[i]!;
      const start = flatResults.length;
      flatResults.push(...results);
      rangeByCompany.set(name, { start, end: flatResults.length });
      companiesForPrompt.push({ companyName: name, results });
    }
    if (flatResults.length === 0) return [];

    const resolutionSchema = companySourcingResolutionOutputSchema.superRefine((output, ctx) => {
      for (const r of output.resolutions) {
        const range = rangeByCompany.get(r.companyName);
        if (!range || r.resultIndex < range.start || r.resultIndex >= range.end) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `resultIndex ${r.resultIndex} for "${r.companyName}" is not one of that company's own result indexes`,
          });
        }
      }
    });

    const resolution = await generateStructuredOutput(this.aiProvider, {
      agentType: "company_sourcing_resolution",
      systemPrompt: buildCompanyDomainResolutionSystemPrompt(),
      userPrompt: buildCompanyDomainResolutionUserPrompt({ companies: companiesForPrompt }),
      schema: resolutionSchema,
      maxTokens: 1000,
    });

    const seenCompanyResolved = new Set<string>();
    const candidates: SourcedCompanyCandidate[] = [];
    for (const r of resolution.resolutions) {
      if (seenCompanyResolved.has(r.companyName)) continue; // at most one resolution per company
      seenCompanyResolved.add(r.companyName);

      const result = flatResults[r.resultIndex]!; // in-range and belongs to this company, guaranteed by resolutionSchema
      candidates.push({
        companyName: r.companyName,
        website: result.url,
        // Best-effort labels from the query the company matched, not a
        // verified fact about this specific company -- same status as
        // CSV import's own optional industry/location columns.
        industry: query.industry,
        location: query.geography,
        notes: result.content.slice(0, 300),
        sourceRef: result.url,
        confidence: 0.6,
      });
    }

    return candidates;
  }
}
