import { describe, expect, it, vi } from "vitest";
import type { AIProvider, GenerateJsonParams } from "../../lib/ai/types";
import { runResearchAgent } from "../../agents/research-agent";
import { runDecisionMakerAgent, splitFullName } from "../../agents/decision-maker-agent";
import { runQualificationAgent } from "../../agents/qualification-agent";
import { runPersonalizationAgent } from "../../agents/personalization-agent";
import { runEmailAgent, needsReview } from "../../agents/email-agent";
import type { SearchProvider } from "../../lib/search/types";
import type { CrawledPage } from "../../lib/scraper/crawler";

/** A provider whose queued responses are returned in order, one per call -- lets a test simulate "bad response, then good response" for the repair-retry path. */
function queuedProvider(responses: string[]): AIProvider {
  let call = 0;
  return {
    name: "queued",
    generateJson: vi.fn(async (_params: GenerateJsonParams) => {
      const response = responses[Math.min(call, responses.length - 1)]!;
      call++;
      return response;
    }),
  };
}

const samplePages: CrawledPage[] = [
  { url: "https://acme.example.com/", title: "Acme", text: "Acme Logistics moves freight across West Africa." },
];

const noOpSearchProvider: SearchProvider = {
  name: "no-op",
  findDecisionMakers: async () => [],
};

describe("runResearchAgent", () => {
  const validResponse = JSON.stringify({
    companySummary: "Acme Logistics is a freight company.",
    industry: "Logistics",
    products: [],
    services: [],
    locations: [],
    technologySignals: [],
    businessSignals: [],
    potentialOpportunities: [],
    leadership: [],
    findings: [
      {
        claim: "Acme moves freight across West Africa.",
        evidence: "Acme Logistics moves freight across West Africa.",
        sourceUrl: "https://acme.example.com/",
        category: "overview",
        factType: "FACT",
        confidence: 0.9,
      },
    ],
  });

  it("returns validated output on a well-formed response", async () => {
    const provider = queuedProvider([validResponse]);
    const result = await runResearchAgent(provider, {
      companyName: "Acme",
      website: "https://acme.example.com",
      pages: samplePages,
    });
    expect(result.industry).toBe("Logistics");
    expect(result.findings).toHaveLength(1);
  });

  it("recovers from a malformed first response via the repair-retry path", async () => {
    const provider = queuedProvider(["not json", validResponse]);
    const result = await runResearchAgent(provider, {
      companyName: "Acme",
      website: "https://acme.example.com",
      pages: samplePages,
    });
    expect(result.industry).toBe("Logistics");
    expect(provider.generateJson).toHaveBeenCalledTimes(2);
  });

  it("throws if no pages were crawled", async () => {
    const provider = queuedProvider([validResponse]);
    await expect(
      runResearchAgent(provider, { companyName: "Acme", website: "https://acme.example.com", pages: [] })
    ).rejects.toThrow(/No pages/);
  });
});

describe("runDecisionMakerAgent", () => {
  const validResponse = JSON.stringify({
    candidates: [
      {
        firstName: "Jane",
        lastName: "Doe",
        fullName: "Jane Doe",
        title: "CEO",
        email: null,
        emailStatus: "unknown",
        sourceUrl: null,
        confidence: 0.6,
        relevanceReason: "CEO matches target role",
      },
    ],
  });

  it("returns validated candidates on a well-formed response", async () => {
    const provider = queuedProvider([validResponse]);
    const result = await runDecisionMakerAgent(provider, noOpSearchProvider, {
      companyName: "Acme",
      companyDomain: "acme.example.com",
      targetRoles: ["CEO"],
      pages: samplePages,
    });
    expect(result.candidates).toHaveLength(1);
  });

  it("recovers from an invalid emailStatus via the repair-retry path", async () => {
    const invalidResponse = JSON.stringify({
      candidates: [{ ...JSON.parse(validResponse).candidates[0], emailStatus: "definitely_real" }],
    });
    const provider = queuedProvider([invalidResponse, validResponse]);
    const result = await runDecisionMakerAgent(provider, noOpSearchProvider, {
      companyName: "Acme",
      companyDomain: "acme.example.com",
      targetRoles: ["CEO"],
      pages: samplePages,
    });
    expect(result.candidates[0]!.emailStatus).toBe("unknown");
  });

  it("backfills firstName/lastName from fullName when the model leaves them null (so email personalization always has a real name to greet, per the 2026-09-14 blank-salutation fix)", async () => {
    const responseWithoutSplitName = JSON.stringify({
      candidates: [
        {
          firstName: null,
          lastName: null,
          fullName: "Shola Akinlade",
          title: "Founder",
          email: null,
          emailStatus: "unknown",
          sourceUrl: "https://paystack.com/about",
          confidence: 0.6,
          relevanceReason: "Founder",
        },
      ],
    });
    const provider = queuedProvider([responseWithoutSplitName]);
    const result = await runDecisionMakerAgent(provider, noOpSearchProvider, {
      companyName: "Paystack",
      companyDomain: "paystack.com",
      targetRoles: ["CEO", "Founder"],
      pages: samplePages,
    });
    expect(result.candidates[0]!.firstName).toBe("Shola");
    expect(result.candidates[0]!.lastName).toBe("Akinlade");
  });

  it("doesn't override firstName the model already provided", async () => {
    const provider = queuedProvider([validResponse]); // firstName "Jane", fullName "Jane Doe"
    const result = await runDecisionMakerAgent(provider, noOpSearchProvider, {
      companyName: "Acme",
      companyDomain: "acme.example.com",
      targetRoles: ["CEO"],
      pages: samplePages,
    });
    expect(result.candidates[0]!.firstName).toBe("Jane");
  });
});

describe("splitFullName", () => {
  it("splits a two-part name", () => {
    expect(splitFullName("Shola Akinlade")).toEqual({ firstName: "Shola", lastName: "Akinlade" });
  });

  it("joins remaining parts into lastName for a multi-part name", () => {
    expect(splitFullName("Mary Anne Smith")).toEqual({ firstName: "Mary", lastName: "Anne Smith" });
  });

  it("leaves lastName null for a single-word name", () => {
    expect(splitFullName("Madonna")).toEqual({ firstName: "Madonna", lastName: null });
  });

  it("returns nulls for an empty/whitespace-only string", () => {
    expect(splitFullName("   ")).toEqual({ firstName: null, lastName: null });
  });
});

describe("runQualificationAgent", () => {
  const campaign = {
    industry: "Logistics",
    geography: "West Africa",
    companySize: "50-200",
    targetRoles: ["CEO"],
    offerDescription: "Freight visibility platform",
  };
  const research = {
    companySummary: "s",
    industry: "Logistics",
    products: [],
    services: [],
    locations: [],
    technologySignals: [],
    businessSignals: [],
    potentialOpportunities: [],
    leadership: [],
    findings: [],
  };
  const decisionMakers = { candidates: [] };

  const modelResponse = JSON.stringify({
    score: 0, // deliberately wrong -- the agent recomputes this deterministically
    tier: "UNQUALIFIED", // deliberately wrong, same reason
    industryScore: 100,
    sizeScore: 100,
    geographyScore: 100,
    problemScore: 100,
    decisionMakerScore: 100,
    buyingSignalScore: 100,
    reasons: [],
    riskFlags: [],
  });

  it("recomputes score/tier deterministically from sub-scores + weights, ignoring the model's own score/tier", async () => {
    const provider = queuedProvider([modelResponse]);
    const result = await runQualificationAgent(provider, { campaign, research, decisionMakers });
    // All sub-scores are 100, weights sum to 1.0 -> overall score should be 100, tier HIGH.
    expect(result.score).toBe(100);
    expect(result.tier).toBe("HIGH");
  });

  it("recovers from a malformed response via the repair-retry path", async () => {
    const provider = queuedProvider(["{broken json", modelResponse]);
    const result = await runQualificationAgent(provider, { campaign, research, decisionMakers });
    expect(result.tier).toBe("HIGH");
    expect(provider.generateJson).toHaveBeenCalledTimes(2);
  });
});

describe("runPersonalizationAgent", () => {
  const findings = [
    {
      id: "finding-0",
      claim: "Acme expanded into Ghana.",
      evidence: "News page excerpt",
      sourceUrl: "https://acme.example.com/news",
      category: "business_signal",
      factType: "FACT" as const,
      confidence: 0.9,
    },
  ];
  const campaign = { offerDescription: "Freight visibility platform", valueProposition: "Real-time tracking", cta: "Book a call" };

  const validResponse = JSON.stringify({
    openingHook: { text: "Saw your Ghana expansion", evidenceIds: ["finding-0"] },
    businessObservation: { text: "Scaling across borders", evidenceIds: ["finding-0"] },
    opportunity: { text: "Visibility gap during expansion", evidenceIds: ["finding-0"] },
    valueConnection: { text: "We help with that", evidenceIds: [] },
    overallConfidence: 0.85,
  });

  it("accepts a response whose evidenceIds all match provided findings", async () => {
    const provider = queuedProvider([validResponse]);
    const result = await runPersonalizationAgent(provider, {
      campaign,
      findings,
      decisionMakerName: "Jane Doe",
      decisionMakerTitle: "CEO",
    });
    expect(result.openingHook.evidenceIds).toEqual(["finding-0"]);
  });

  it("rejects a hallucinated evidenceId and recovers via the repair-retry path", async () => {
    const hallucinated = JSON.stringify({
      ...JSON.parse(validResponse),
      openingHook: { text: "Made up claim", evidenceIds: ["finding-does-not-exist"] },
    });
    const provider = queuedProvider([hallucinated, validResponse]);
    const result = await runPersonalizationAgent(provider, {
      campaign,
      findings,
      decisionMakerName: "Jane Doe",
      decisionMakerTitle: "CEO",
    });
    expect(result.openingHook.evidenceIds).toEqual(["finding-0"]);
    expect(provider.generateJson).toHaveBeenCalledTimes(2);
  });

  it("throws if no findings were provided", async () => {
    const provider = queuedProvider([validResponse]);
    await expect(
      runPersonalizationAgent(provider, { campaign, findings: [], decisionMakerName: null, decisionMakerTitle: null })
    ).rejects.toThrow(/at least one/);
  });
});

describe("runEmailAgent", () => {
  const personalization = {
    openingHook: { text: "Saw your Ghana expansion", evidenceIds: ["finding-0"] },
    businessObservation: { text: "Scaling across borders", evidenceIds: ["finding-0"] },
    opportunity: { text: "Visibility gap during expansion", evidenceIds: ["finding-0"] },
    valueConnection: { text: "We help with that", evidenceIds: [] },
    overallConfidence: 0.85,
  };
  const campaign = {
    offerDescription: "Freight visibility platform",
    valueProposition: "Real-time tracking",
    cta: "Book a call",
    researchInstructions: null,
  };

  const validResponse = JSON.stringify({
    subject: "Quick question about your Ghana expansion",
    body: "Hi Jane, noticed your Ghana expansion...",
    cta: "Open to a 15-minute call?",
    personalizationHook: "Ghana expansion",
    evidenceIds: ["finding-0"],
    confidence: 0.8,
  });

  it("accepts a response whose evidenceIds are a subset of the personalization's evidence", async () => {
    const provider = queuedProvider([validResponse]);
    const result = await runEmailAgent(provider, { campaign, personalization, recipientFirstName: "Jane" });
    expect(result.subject).toContain("Ghana");
  });

  it("rejects an evidenceId not present in the personalization material and recovers", async () => {
    const bad = JSON.stringify({ ...JSON.parse(validResponse), evidenceIds: ["finding-not-in-personalization"] });
    const provider = queuedProvider([bad, validResponse]);
    const result = await runEmailAgent(provider, { campaign, personalization, recipientFirstName: "Jane" });
    expect(result.evidenceIds).toEqual(["finding-0"]);
  });
});

describe("needsReview", () => {
  it("routes below-threshold confidence to review", () => {
    expect(needsReview(0.5)).toBe(true);
    expect(needsReview(0.9)).toBe(false);
    expect(needsReview(0.5, 0.4)).toBe(false);
  });
});
