import { describe, expect, it } from "vitest";
import { MockAIProvider } from "../../lib/ai/mock";
import { MockSearchProvider } from "../../lib/search/mock";
import { MockEmailProvider } from "../../lib/email/mock";
import {
  researchOutputSchema,
  decisionMakerOutputSchema,
  qualificationOutputSchema,
  personalizationOutputSchema,
  emailOutputSchema,
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
