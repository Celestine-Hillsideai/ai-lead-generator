import type { AIProvider, GenerateJsonParams } from "./types";

/**
 * Deterministic mock AI provider, per docs/spec.md §29 (MOCK_AI=true): no
 * live API calls, same shape every time. Returns a canned, schema-valid
 * fixture per agent type -- agents parse/validate this exactly like a real
 * model response, so the mock exercises the same Zod-validation code path
 * (not a special-cased bypass).
 */

// "personalization", "email", "company_sourcing", and "company_sourcing_resolution" are built dynamically (see the build*Fixture functions below) rather than listed here.
const FIXTURES: Record<
  Exclude<GenerateJsonParams["agentType"], "personalization" | "email" | "company_sourcing" | "company_sourcing_resolution">,
  unknown
> = {
  research: {
    companySummary: "Acme Logistics is a freight and warehousing company operating in West Africa.",
    industry: "Logistics",
    products: ["Freight tracking platform"],
    services: ["Warehousing", "Last-mile delivery"],
    locations: ["Lagos, Nigeria", "Accra, Ghana"],
    technologySignals: ["Site built on React"],
    businessSignals: ["Recently expanded operations into Ghana"],
    potentialOpportunities: ["No visible API integration with major carriers"],
    leadership: [{ name: "Jane Doe", title: "CEO", sourceUrl: "https://example.com/about" }],
    findings: [
      {
        claim: "Acme Logistics expanded operations into Ghana.",
        evidence: "\"We're excited to announce our new Ghana office\" -- News page",
        sourceUrl: "https://example.com/news/expansion",
        category: "business_signal",
        factType: "FACT",
        confidence: 0.95,
      },
    ],
  },
  decision_maker: {
    candidates: [
      {
        firstName: "Jane",
        lastName: "Doe",
        fullName: "Jane Doe",
        title: "CEO",
        email: "jane@example.com",
        emailStatus: "public",
        sourceUrl: "https://example.com/about",
        confidence: 0.9,
        relevanceReason: "CEO is the top-priority role per the campaign's target roles.",
      },
    ],
  },
  qualification: {
    score: 78,
    tier: "MEDIUM",
    industryScore: 90,
    sizeScore: 70,
    geographyScore: 80,
    problemScore: 75,
    decisionMakerScore: 85,
    buyingSignalScore: 60,
    reasons: [
      {
        factor: "industryFit",
        reasoning: "Company operates in the target logistics industry.",
        evidenceIds: [],
      },
    ],
    riskFlags: [],
  },
};

/**
 * Extracts finding/evidence ids embedded in a prompt's JSON payload (e.g.
 * `"id": "finding-abc123"` or `"evidenceIds": ["finding-abc123"]`). The
 * personalization and email agents' Zod schemas reject an evidenceId that
 * doesn't match a real finding they were given (agents/personalization-agent.ts,
 * agents/email-agent.ts) -- since those real ids are assigned by the
 * database repository at runtime (see lib/database/supabase-repository.ts's
 * replaceResearch), a static fixture can't reference them. Pulling the ids
 * out of the prompt itself keeps the mock provider fully deterministic and
 * dependency-free while still producing a response that passes validation.
 */
function extractIds(userPrompt: string, key: "id" | "evidenceIds"): string[] {
  const pattern = key === "id" ? /"id":\s*"([^"]+)"/g : /"evidenceIds":\s*\[\s*"([^"]+)"/g;
  return Array.from(userPrompt.matchAll(pattern)).map((m) => m[1]!);
}

function buildPersonalizationFixture(userPrompt: string) {
  const evidenceId = extractIds(userPrompt, "id")[0] ?? "unknown-finding";
  return {
    openingHook: { text: "Noticed a relevant recent development for this company.", evidenceIds: [evidenceId] },
    businessObservation: { text: "Their current scale suggests an operational gap.", evidenceIds: [evidenceId] },
    opportunity: { text: "This looks like a good fit for the offer.", evidenceIds: [evidenceId] },
    valueConnection: { text: "Our platform addresses exactly this kind of gap.", evidenceIds: [] },
    overallConfidence: 0.8,
  };
}

function buildEmailFixture(userPrompt: string) {
  const evidenceIds = extractIds(userPrompt, "evidenceIds");
  const evidenceId = evidenceIds[0] ?? "unknown-finding";
  return {
    subject: "Quick question about your recent growth",
    body: "Hi there, noticed some recent developments worth a quick conversation. We help companies like yours close exactly this kind of gap with real-time visibility. Worth a short call this week to see if it's a fit?",
    cta: "Open to a 15-minute call this week?",
    personalizationHook: "Recent development",
    evidenceIds: [evidenceId],
    confidence: 0.8,
  };
}

/** One candidate at index 0 if the prompt shows at least one result, otherwise none -- mirrors real behavior for an empty result set. */
function buildCompanySourcingFixture(userPrompt: string) {
  const hasResult = /--- BEGIN UNTRUSTED EXTERNAL CONTENT: result 0 ---/.test(userPrompt);
  return { candidates: hasResult ? [{ resultIndex: 0, companyName: "Mock Sourced Co" }] : [] };
}

/** For each "## Company: X" section in the prompt, resolve to that section's first listed result index, if any. */
function buildCompanySourcingResolutionFixture(userPrompt: string) {
  const sections = userPrompt.split(/^## Company: /m).slice(1);
  const resolutions: { companyName: string; resultIndex: number }[] = [];
  for (const section of sections) {
    const [companyName, ...rest] = section.split("\n");
    const match = rest.join("\n").match(/--- BEGIN UNTRUSTED EXTERNAL CONTENT: result (\d+) ---/);
    if (companyName && match) {
      resolutions.push({ companyName: companyName.trim(), resultIndex: Number(match[1]) });
    }
  }
  return { resolutions };
}

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generateJson(params: GenerateJsonParams): Promise<string> {
    if (params.agentType === "personalization") {
      return JSON.stringify(buildPersonalizationFixture(params.userPrompt));
    }
    if (params.agentType === "email") {
      return JSON.stringify(buildEmailFixture(params.userPrompt));
    }
    if (params.agentType === "company_sourcing") {
      return JSON.stringify(buildCompanySourcingFixture(params.userPrompt));
    }
    if (params.agentType === "company_sourcing_resolution") {
      return JSON.stringify(buildCompanySourcingResolutionFixture(params.userPrompt));
    }
    return JSON.stringify(FIXTURES[params.agentType]);
  }
}
