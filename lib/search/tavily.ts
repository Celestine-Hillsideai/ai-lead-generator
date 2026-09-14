import { z } from "zod";
import type { AIProvider } from "../ai/types";
import { generateStructuredOutput } from "../ai/generate-structured";
import { decisionMakerSearchExtractionOutputSchema } from "../../types/contracts";
import { buildDecisionMakerSearchSystemPrompt, buildDecisionMakerSearchUserPrompt } from "../../prompts/decision-maker-search.prompt";
import type { DecisionMakerSearchQuery, DecisionMakerSearchResult, SearchProvider } from "./types";

/**
 * Real SearchProvider backed by Tavily's web-search API (same account/key
 * shape as lib/sourcing/tavily.ts -- see that module's docstring for why
 * Tavily was chosen: a genuinely usable free tier, unlike Apollo.io's
 * organization-search endpoint).
 *
 * One search + one AI extraction call (simpler than lib/sourcing/tavily.ts's
 * two-stage design -- there's no "resolve to the right domain" problem here,
 * and agents/decision-maker-agent.ts already runs its own synthesis pass
 * combining this provider's output with the company's own crawled pages, so
 * this provider's job is just to surface real, named candidates for that
 * outer pass to weigh). The model only ever picks a resultIndex into real,
 * already-fetched results (validated in-range via a per-call superRefine,
 * same idiom personalization/sourcing use) -- a candidate's sourceUrl is
 * always built from that real result, never from text the model writes.
 *
 * Email handling (spec §4: "never fabricate or guess email addresses"): the
 * model is instructed to only report an email that's written out verbatim in
 * the result content, and this is re-verified in code -- an email that
 * doesn't literally appear in its claimed source is silently dropped (not
 * retried/rejected, since the information may genuinely not be there) rather
 * than surfaced. This is the highest-stakes fabrication risk in this
 * provider, so it gets a second, code-level check on top of the prompt
 * instruction, not just prompt discipline alone.
 */

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

interface TavilySearchResponse {
  results?: TavilySearchResultItem[];
}
interface TavilySearchResultItem {
  title: string;
  url: string;
  content: string;
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = "tavily";

  constructor(
    private readonly apiKey: string,
    private readonly aiProvider: AIProvider
  ) {}

  async findDecisionMakers(query: DecisionMakerSearchQuery): Promise<DecisionMakerSearchResult[]> {
    const role = query.targetRoles[0] ?? "CEO";
    const searchQuery = `"${query.companyName}" ${role} OR founder OR "leadership team"`;

    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        query: searchQuery,
        search_depth: "basic",
        max_results: 8,
        include_domains: [query.companyDomain],
        include_domains_mode: "boost", // prefer the company's own site without excluding legitimate external mentions (press, directories)
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Tavily search failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as TavilySearchResponse;
    const results = data.results ?? [];
    if (results.length === 0) return [];

    const schemaWithIndexCheck = decisionMakerSearchExtractionOutputSchema.superRefine((output, ctx) => {
      for (const c of output.candidates) {
        if (c.resultIndex >= results.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `resultIndex ${c.resultIndex} is out of range for ${results.length} provided result(s)`,
          });
        }
      }
    });

    const extraction = await generateStructuredOutput(this.aiProvider, {
      agentType: "decision_maker_search",
      systemPrompt: buildDecisionMakerSearchSystemPrompt(),
      userPrompt: buildDecisionMakerSearchUserPrompt({
        companyName: query.companyName,
        targetRoles: query.targetRoles,
        results,
      }),
      schema: schemaWithIndexCheck,
      maxTokens: 1000,
    });

    const seenNames = new Set<string>();
    const candidates: DecisionMakerSearchResult[] = [];
    for (const c of extraction.candidates) {
      const key = c.fullName.trim().toLowerCase();
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);

      const result = results[c.resultIndex]!; // in-range, guaranteed by schemaWithIndexCheck
      const emailReallyInContent = c.email ? result.content.toLowerCase().includes(c.email.toLowerCase()) : false;

      candidates.push({
        fullName: c.fullName,
        title: c.title,
        email: emailReallyInContent ? c.email : null,
        emailStatus: emailReallyInContent ? "public" : "unknown",
        sourceUrl: result.url,
        confidence: 0.6,
      });
    }

    return candidates;
  }
}
