import { describe, expect, it } from "vitest";
import {
  researchOutputSchema,
  decisionMakerOutputSchema,
  qualificationOutputSchema,
  personalizationOutputSchema,
  emailOutputSchema,
  scoreToTier,
  countWords,
} from "../../types/contracts";

describe("researchOutputSchema", () => {
  const valid = {
    companySummary: "A logistics company operating in West Africa.",
    industry: "Logistics",
    products: ["Freight tracking"],
    services: ["Warehousing"],
    locations: ["Lagos, Nigeria"],
    technologySignals: ["Uses React on their site"],
    businessSignals: ["Recently expanded to Ghana"],
    potentialOpportunities: ["No visible API integrations"],
    leadership: [{ name: "Jane Doe", title: "CEO", sourceUrl: "https://example.com/about" }],
    findings: [
      {
        claim: "Company expanded operations into Ghana.",
        evidence: "\"We're excited to announce our Ghana office\" -- News page",
        sourceUrl: "https://example.com/news/expansion",
        category: "business_signal",
        factType: "FACT",
        confidence: 0.98,
      },
    ],
  };

  it("accepts a well-formed payload", () => {
    expect(researchOutputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a finding missing sourceUrl (evidence must be traceable)", () => {
    const malformed = {
      ...valid,
      findings: [{ ...valid.findings[0], sourceUrl: undefined }],
    };
    expect(() => researchOutputSchema.parse(malformed)).toThrow();
  });

  it("rejects an invalid factType", () => {
    const malformed = {
      ...valid,
      findings: [{ ...valid.findings[0], factType: "MAYBE" }],
    };
    expect(() => researchOutputSchema.parse(malformed)).toThrow();
  });
});

describe("decisionMakerOutputSchema", () => {
  it("accepts a well-formed candidate list", () => {
    const valid = {
      candidates: [
        {
          firstName: "Jane",
          lastName: "Doe",
          fullName: "Jane Doe",
          title: "CEO",
          email: "jane@example.com",
          emailStatus: "public",
          sourceUrl: "https://example.com/team",
          confidence: 0.9,
          relevanceReason: "CEO is top-priority role per spec §14",
        },
      ],
    };
    expect(decisionMakerOutputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects an invalid emailStatus (must be one of the defined verification states)", () => {
    const malformed = {
      candidates: [
        {
          firstName: null,
          lastName: null,
          fullName: "Jane Doe",
          title: "CEO",
          email: null,
          emailStatus: "probably_real",
          sourceUrl: null,
          confidence: 0.5,
          relevanceReason: "test",
        },
      ],
    };
    expect(() => decisionMakerOutputSchema.parse(malformed)).toThrow();
  });
});

describe("qualificationOutputSchema + scoreToTier", () => {
  it("accepts a well-formed qualification result", () => {
    const valid = {
      score: 85,
      tier: "HIGH",
      industryScore: 90,
      sizeScore: 80,
      geographyScore: 100,
      problemScore: 70,
      decisionMakerScore: 90,
      buyingSignalScore: 60,
      reasons: [{ factor: "industryFit", reasoning: "Matches target industry", evidenceIds: ["f1"] }],
      riskFlags: [],
    };
    expect(qualificationOutputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects a score outside 0-100", () => {
    expect(() =>
      qualificationOutputSchema.parse({
        score: 150,
        tier: "HIGH",
        industryScore: 0,
        sizeScore: 0,
        geographyScore: 0,
        problemScore: 0,
        decisionMakerScore: 0,
        buyingSignalScore: 0,
        reasons: [],
        riskFlags: [],
      })
    ).toThrow();
  });

  it.each([
    [95, "HIGH"],
    [80, "HIGH"],
    [79, "MEDIUM"],
    [60, "MEDIUM"],
    [59, "LOW"],
    [40, "LOW"],
    [39, "UNQUALIFIED"],
    [0, "UNQUALIFIED"],
  ])("scoreToTier(%i) === %s", (score, expected) => {
    expect(scoreToTier(score)).toBe(expected);
  });
});

describe("personalizationOutputSchema", () => {
  const valid = {
    openingHook: { text: "Saw you just expanded into Ghana", evidenceIds: ["f1"] },
    businessObservation: { text: "Your team is scaling warehousing", evidenceIds: ["f2"] },
    opportunity: { text: "Freight visibility gap during expansion", evidenceIds: ["f1", "f2"] },
    valueConnection: { text: "We help scaling logistics teams track freight", evidenceIds: [] },
    overallConfidence: 0.82,
  };

  it("accepts a well-formed payload", () => {
    expect(personalizationOutputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects an opening hook with no evidenceIds (claim without evidence)", () => {
    const malformed = { ...valid, openingHook: { text: "Great company!", evidenceIds: [] } };
    expect(() => personalizationOutputSchema.parse(malformed)).toThrow();
  });
});

describe("emailOutputSchema + countWords", () => {
  it("accepts a well-formed draft", () => {
    const valid = {
      subject: "Quick question about your Ghana expansion",
      body: "Hi Jane, noticed your recent expansion...",
      cta: "Open to a 15-minute call this week?",
      personalizationHook: "Ghana expansion",
      evidenceIds: ["f1"],
      confidence: 0.75,
    };
    expect(emailOutputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects an empty body", () => {
    expect(() =>
      emailOutputSchema.parse({
        subject: "Subject",
        body: "",
        cta: "CTA",
        personalizationHook: "hook",
        evidenceIds: [],
        confidence: 0.5,
      })
    ).toThrow();
  });

  it("countWords counts whitespace-separated words", () => {
    expect(countWords("Hi Jane, hope you're well.")).toBe(5);
    expect(countWords("  extra   spaces  ")).toBe(2);
  });
});
