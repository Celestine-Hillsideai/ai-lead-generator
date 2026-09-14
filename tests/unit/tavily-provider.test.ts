import { describe, expect, it, vi, afterEach } from "vitest";
import type { AIProvider, GenerateJsonParams } from "../../lib/ai/types";
import { TavilySourcingProvider } from "../../lib/sourcing/tavily";
import type { CompanySourcingQuery } from "../../lib/sourcing/types";

const baseQuery: CompanySourcingQuery = {
  industry: "Fintech",
  geography: "United States",
  companySize: "50-200 employees",
  targetRoles: ["CEO"],
  offerDescription: null,
  targetCount: 5,
};

function queuedAIProvider(responses: string[]): AIProvider {
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

function stubFetch(response: { ok: boolean; status?: number; json?: unknown; text?: string }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.json,
    text: async () => response.text ?? "",
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const twoResults = {
  results: [
    { title: "Acme Fintech - Home", url: "https://acmefintech.com", content: "Acme Fintech builds payment infrastructure." },
    { title: "Top 10 Fintech Startups - Blog", url: "https://blog.example.com/top-10", content: "A listicle covering many companies." },
  ],
};

describe("TavilySourcingProvider", () => {
  it("calls Tavily then the AI provider, and builds candidates from the real result at the model-chosen index", async () => {
    const fetchMock = stubFetch({ ok: true, json: twoResults });
    const ai = queuedAIProvider([JSON.stringify({ candidates: [{ resultIndex: 0, companyName: "Acme Fintech" }] })]);

    const provider = new TavilySourcingProvider("tvly-test-key", ai);
    const results = await provider.findCompanies(baseQuery);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.tavily.com/search");
    expect(init.headers.Authorization).toBe("Bearer tvly-test-key");
    expect(JSON.parse(init.body).query).toContain("Fintech");

    expect(results).toEqual([
      {
        companyName: "Acme Fintech",
        website: "https://acmefintech.com",
        industry: "Fintech",
        location: "United States",
        notes: "Acme Fintech builds payment infrastructure.",
        sourceRef: "https://acmefintech.com",
        confidence: 0.6,
      },
    ]);
  });

  it("never fabricates a website: an out-of-range resultIndex fails validation and triggers the repair-retry loop", async () => {
    stubFetch({ ok: true, json: twoResults });
    const ai = queuedAIProvider([
      JSON.stringify({ candidates: [{ resultIndex: 99, companyName: "Nonexistent Co" }] }), // out of range -- rejected
      JSON.stringify({ candidates: [{ resultIndex: 0, companyName: "Acme Fintech" }] }), // repaired
    ]);

    const provider = new TavilySourcingProvider("tvly-test-key", ai);
    const results = await provider.findCompanies(baseQuery);

    expect(ai.generateJson).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(1);
    expect(results[0]!.website).toBe("https://acmefintech.com");
  });

  it("skips search entirely when Tavily returns zero results, without calling the AI provider", async () => {
    stubFetch({ ok: true, json: { results: [] } });
    const ai = queuedAIProvider([JSON.stringify({ candidates: [] })]);

    const provider = new TavilySourcingProvider("tvly-test-key", ai);
    const results = await provider.findCompanies(baseQuery);

    expect(results).toEqual([]);
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it("de-dupes candidates that reference the same resultIndex twice", async () => {
    stubFetch({ ok: true, json: twoResults });
    const ai = queuedAIProvider([
      JSON.stringify({
        candidates: [
          { resultIndex: 0, companyName: "Acme Fintech" },
          { resultIndex: 0, companyName: "Acme Fintech Inc" },
        ],
      }),
    ]);

    const provider = new TavilySourcingProvider("tvly-test-key", ai);
    const results = await provider.findCompanies(baseQuery);

    expect(results).toHaveLength(1);
  });

  it("throws with response detail on a non-ok Tavily response", async () => {
    stubFetch({ ok: false, status: 401, text: "Invalid API key" });
    const ai = queuedAIProvider([JSON.stringify({ candidates: [] })]);

    const provider = new TavilySourcingProvider("bad-key", ai);
    await expect(provider.findCompanies(baseQuery)).rejects.toThrow(/401/);
  });
});
