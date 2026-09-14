import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../../lib/ai/mock";
import { MockSearchProvider } from "../../lib/search/mock";
import { MockEmailProvider } from "../../lib/email/mock";
import { MockCompanySourcingProvider } from "../../lib/sourcing/mock";
import {
  researchOutputSchema,
  decisionMakerOutputSchema,
  qualificationOutputSchema,
  personalizationOutputSchema,
  emailOutputSchema,
  companySourcingExtractionOutputSchema,
  companySourcingResolutionOutputSchema,
} from "../../types/contracts";
import type { AgentType } from "../../types/status";

describe("MockAIProvider", () => {
  const provider = new MockAIProvider();

  const cases: [AgentType, unknown][] = [
    ["research", researchOutputSchema],
    ["decision_maker", decisionMakerOutputSchema],
    ["qualification", qualificationOutputSchema],
    ["personalization", personalizationOutputSchema],
    ["email", emailOutputSchema],
    ["company_sourcing", companySourcingExtractionOutputSchema],
    ["company_sourcing_resolution", companySourcingResolutionOutputSchema],
  ];

  it.each(cases)("returns a schema-valid fixture for agentType=%s", async (agentType, schema) => {
    const raw = await provider.generateJson({ agentType, systemPrompt: "s", userPrompt: "u" });
    const parsed = JSON.parse(raw);
    expect(() => (schema as { parse: (v: unknown) => unknown }).parse(parsed)).not.toThrow();
  });

  it("is deterministic across calls", async () => {
    const a = await provider.generateJson({ agentType: "research", systemPrompt: "s", userPrompt: "u1" });
    const b = await provider.generateJson({ agentType: "research", systemPrompt: "s", userPrompt: "u2" });
    expect(a).toBe(b);
  });
});

describe("MockSearchProvider", () => {
  it("returns a deterministic candidate using the first target role", async () => {
    const provider = new MockSearchProvider();
    const results = await provider.findDecisionMakers({
      companyName: "Acme",
      companyDomain: "acme.example.com",
      targetRoles: ["CTO", "CEO"],
    });
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe("CTO");
    expect(results[0]!.emailStatus).toBe("unknown");
  });
});

describe("MockCompanySourcingProvider", () => {
  it("returns candidates capped at its real-domain pool size, each traceable to a sourceRef", async () => {
    const provider = new MockCompanySourcingProvider();
    const results = await provider.findCompanies({
      industry: "Fintech",
      geography: "Nigeria",
      companySize: "50-200",
      targetRoles: ["CEO"],
      offerDescription: "Payments infrastructure",
      targetCount: 10,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(10);
    for (const candidate of results) {
      expect(candidate.sourceRef).toMatch(/^mock:\/\//);
      expect(candidate.companyName).toBeTruthy();
      expect(candidate.website).toMatch(/^https:\/\//);
    }
  });

  it("respects a smaller targetCount than its pool", async () => {
    const provider = new MockCompanySourcingProvider();
    const results = await provider.findCompanies({
      industry: null,
      geography: null,
      companySize: null,
      targetRoles: [],
      offerDescription: null,
      targetCount: 1,
    });
    expect(results).toHaveLength(1);
  });
});

describe("MockEmailProvider", () => {
  it("always succeeds without sending anything", async () => {
    const provider = new MockEmailProvider();
    const result = await provider.send({
      to: "jane@example.com",
      from: "sender@example.com",
      subject: "Hi",
      body: "Body",
      campaignId: "c1",
      contactId: "ct1",
    });
    expect(result.success).toBe(true);
    expect(result.providerMessageId).toContain("c1");
  });
});
