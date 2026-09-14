import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { generateStructuredOutput } from "../ai/generate-structured";
import { companySourcingExtractionOutputSchema } from "../../types/contracts";
import { buildCompanySourcingSystemPrompt, buildCompanySourcingUserPrompt } from "../../prompts/company-sourcing.prompt";
import type { CompanySourcingProvider, CompanySourcingQuery, SourcedCompanyCandidate } from "./types";

/**
 * Real CompanySourcingProvider backed by Tavily's web-search API (a free
 * tier is actually usable for this, unlike Apollo.io's organization-search
 * endpoint -- see workflows/03-phase-plan.md's 2026-09-14 note) plus one AI
 * extraction call to turn raw search results into company candidates.
 *
 * Unlike lib/sourcing/apollo.ts (a structured company database, no AI
 * needed), Tavily only returns web pages -- so this is the "provider does
 * its own internal LLM extraction" case anticipated in lib/sourcing/types.ts's
 * design: every candidate's website/sourceRef is built from the REAL search
 * result at the model-chosen index, never from text the model writes, so a
 * hallucinated URL is structurally impossible (see the superRefine below,
 * same idiom as agents/personalization-agent.ts's evidenceId check).
 */

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

interface TavilySearchResultItem {
  title: string;
  url: string;
  content: string;
}

interface TavilySearchResponse {
  results?: TavilySearchResultItem[];
}

function buildIcpQuery(query: CompanySourcingQuery): string {
  const parts: string[] = ["companies"];
  if (query.industry) parts.push(`in the ${query.industry} industry`);
  if (query.geography) parts.push(`located in ${query.geography}`);
  if (query.companySize) parts.push(`with ${query.companySize}`);
  return parts.join(" ");
}

function buildIcpDescription(query: CompanySourcingQuery): string {
  return [
    query.industry ? `Industry: ${query.industry}` : null,
    query.geography ? `Geography: ${query.geography}` : null,
    query.companySize ? `Company size: ${query.companySize}` : null,
    query.targetRoles.length > 0 ? `Buyer roles: ${query.targetRoles.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(". ") || "No specific ICP criteria provided.";
}

export class TavilySourcingProvider implements CompanySourcingProvider {
  readonly name = "tavily";

  constructor(
    private readonly apiKey: string,
    private readonly aiProvider: AIProvider
  ) {}

  async findCompanies(query: CompanySourcingQuery): Promise<SourcedCompanyCandidate[]> {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: buildIcpQuery(query),
        search_depth: "basic",
        max_results: Math.min(Math.max(query.targetCount, 1), 20), // Tavily's per-request cap
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Tavily search failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as TavilySearchResponse;
    const results = data.results ?? [];
    if (results.length === 0) return [];

    const schemaWithIndexCheck = companySourcingExtractionOutputSchema.superRefine((output, ctx) => {
      for (const candidate of output.candidates) {
        if (candidate.resultIndex >= results.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `resultIndex ${candidate.resultIndex} is out of range for ${results.length} provided result(s)`,
          });
        }
      }
    });

    const extraction = await generateStructuredOutput(this.aiProvider, {
      agentType: "company_sourcing",
      systemPrompt: buildCompanySourcingSystemPrompt(),
      userPrompt: buildCompanySourcingUserPrompt({
        icpDescription: buildIcpDescription(query),
        results: results.map((r) => ({ title: r.title, url: r.url, content: r.content })),
      }),
      schema: schemaWithIndexCheck,
      maxTokens: 1500,
    });

    // De-dupe by resultIndex in case the model referenced the same result twice.
    const seenIndexes = new Set<number>();

    return extraction.candidates
      .filter((c) => {
        if (seenIndexes.has(c.resultIndex)) return false;
        seenIndexes.add(c.resultIndex);
        return true;
      })
      .map((c): SourcedCompanyCandidate => {
        const result = results[c.resultIndex]!; // in-range, guaranteed by schemaWithIndexCheck
        return {
          companyName: c.companyName,
          website: result.url,
          // Best-effort labels from the query the company matched, not a
          // verified fact about this specific company -- same status as
          // CSV import's own optional industry/location columns.
          industry: query.industry,
          location: query.geography,
          notes: result.content.slice(0, 300),
          sourceRef: result.url,
          confidence: 0.6,
        };
      });
  }
}
