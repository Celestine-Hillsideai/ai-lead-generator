import type { AIProvider, GenerateJsonParams } from "./types";

/**
 * Deterministic mock AI provider, per docs/spec.md §29 (MOCK_AI=true): no
 * live API calls, same shape every time. Returns a canned, schema-valid
 * fixture per agent type -- agents parse/validate this exactly like a real
 * model response, so the mock exercises the same Zod-validation code path
 * (not a special-cased bypass).
 */

const FIXTURES: Record<GenerateJsonParams["agentType"], unknown> = {
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
  personalization: {
    openingHook: {
      text: "Noticed Acme Logistics just expanded into Ghana.",
      evidenceIds: ["mock-finding-1"],
    },
    businessObservation: {
      text: "Scaling warehousing across two countries raises visibility challenges.",
      evidenceIds: ["mock-finding-1"],
    },
    opportunity: {
      text: "No visible carrier API integration suggests manual tracking overhead.",
      evidenceIds: ["mock-finding-1"],
    },
    valueConnection: {
      text: "Our platform gives logistics teams real-time freight visibility during expansion.",
      evidenceIds: [],
    },
    overallConfidence: 0.8,
  },
  email: {
    subject: "Quick question about your Ghana expansion",
    body: "Hi Jane, noticed Acme Logistics just expanded into Ghana -- congrats. Scaling warehousing across two countries usually means more manual tracking overhead until systems catch up. We help logistics teams get real-time freight visibility during exactly this kind of expansion. Worth a quick chat?",
    cta: "Open to a 15-minute call this week?",
    personalizationHook: "Ghana expansion",
    evidenceIds: ["mock-finding-1"],
    confidence: 0.8,
  },
};

export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generateJson(params: GenerateJsonParams): Promise<string> {
    return JSON.stringify(FIXTURES[params.agentType]);
  }
}
