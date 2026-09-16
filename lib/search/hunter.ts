import type { ContactEmailStatus } from "../../types/status";
import type { DecisionMakerSearchQuery, DecisionMakerSearchResult, SearchProvider } from "./types";

/**
 * Real SearchProvider backed by Hunter.io's Domain Search API -- unlike
 * lib/search/tavily.ts, this needs no AI extraction step at all: Hunter
 * returns already-structured real people (name, position, email, a
 * per-address verification status) for a domain, aggregated from its own
 * licensed data sources. Every field here maps directly from Hunter's real
 * response -- there's no model-generated text anywhere in this provider, so
 * "never fabricate" (spec §4) holds trivially, not just structurally.
 *
 * This exists because Tavily-only search almost never surfaces a real email
 * (most companies don't publish one), which made sourced leads uncontactable
 * -- see workflows/03-phase-plan.md's 2026-09-16 note. Hunter's free tier
 * (confirmed live) predicts/aggregates real addresses per domain with a
 * verification status, giving contacts.email a real chance of being
 * genuinely usable instead of always "unknown".
 */

const HUNTER_DOMAIN_SEARCH_URL = "https://api.hunter.io/v2/domain-search";

interface HunterEmailEntry {
  value: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  position_raw: string | null;
  linkedin: string | null;
  sources: { uri: string }[];
  confidence: number; // 0-100
  verification: { status: string | null };
}

interface HunterDomainSearchResponse {
  data?: {
    emails?: HunterEmailEntry[];
  };
  errors?: { details?: string }[];
}

function mapVerificationStatus(status: string | null): ContactEmailStatus {
  switch (status) {
    case "valid":
      return "verified";
    case "accept_all":
    case "webmail":
      return "unverified"; // deliverable is plausible but not confirmed for this specific address
    case "invalid":
    case "disposable":
      return "invalid";
    default:
      return "unknown";
  }
}

export class HunterSearchProvider implements SearchProvider {
  readonly name = "hunter";

  constructor(private readonly apiKey: string) {}

  async findDecisionMakers(query: DecisionMakerSearchQuery): Promise<DecisionMakerSearchResult[]> {
    const url = `${HUNTER_DOMAIN_SEARCH_URL}?domain=${encodeURIComponent(query.companyDomain)}&limit=10&api_key=${encodeURIComponent(this.apiKey)}`;
    const response = await fetch(url);

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Hunter.io domain search failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const data = (await response.json()) as HunterDomainSearchResponse;
    const emails = data.data?.emails ?? [];

    return emails
      .filter((e) => e.value) // Hunter's free tier can include generic/unnamed addresses -- still keep those (a real inbox is still a real inbox), just needs SOME email value
      .map((e): DecisionMakerSearchResult => {
        const fullName = [e.first_name, e.last_name].filter(Boolean).join(" ").trim();
        return {
          fullName: fullName || e.value, // fall back to the email itself if Hunter has no name attached (e.g. a generic/role address)
          title: e.position_raw ?? e.position ?? "Unknown",
          email: e.value,
          emailStatus: mapVerificationStatus(e.verification?.status ?? null),
          sourceUrl: e.linkedin ?? e.sources[0]?.uri ?? null,
          confidence: Math.min(1, Math.max(0, e.confidence / 100)),
        };
      });
  }
}
