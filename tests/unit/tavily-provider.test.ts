import { describe, expect, it, vi, afterEach } from "vitest";
import type { AIProvider, GenerateJsonParams } from "../../lib/ai/types";
import { TavilySourcingProvider } from "../../lib/sourcing/tavily";
import type { CompanySourcingQuery } from "../../lib/sourcing/types";

const baseQuery: CompanySourcingQuery = {
  industry: "Fintech",
  geography: "Nigeria",
  companySize: "50-200 employees",
  targetRoles: ["CEO"],
  offerDescription: null,
  targetCount: 5,
};

/** Returns queued responses per call, one per stage (extraction, then resolution) -- extra calls beyond the queue reuse the last entry, so a repair-retry within a stage can be simulated by queuing [bad, good, ...next stage]. */
function queuedAIProvider(responses: string[]): AIProvider & { generateJson: ReturnType<typeof vi.fn> } {
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

/** Stubs fetch to return one JSON body per call, in call order (call 0 = discovery search, call 1..N = per-company resolution searches, matching Promise.all's invocation order). */
function stubFetchSequence(bodies: unknown[]) {
  let call = 0;
  const fetchMock = vi.fn().mockImplementation(async () => {
    const body = bodies[Math.min(call, bodies.length - 1)];
    call++;
    return { ok: true, status: 200, json: async () => body, text: async () => "" };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const discoveryResults = {
  results: [
    { title: "Top 10 Fintech Startups", url: "https://blog.example.com/top-10", content: "1. Acme Fintech is a leader. 2. Other Co is also notable." },
  ],
};

const acmeResolutionResults = {
  results: [
    { title: "Acme Fintech | LinkedIn", url: "https://linkedin.com/company/acme", content: "Acme on LinkedIn" },
    { title: "Acme Fintech - Home", url: "https://acmefintech.com", content: "Acme Fintech builds payment infrastructure." },
  ],
};

describe("TavilySourcingProvider", () => {
  it("two-stage happy path: extracts a real company name, then resolves it to its real official site", async () => {
    const fetchMock = stubFetchSequence([discoveryResults, acmeResolutionResults]);
    const ai = queuedAIProvider([
      JSON.stringify({ candidates: [{ resultIndex: 0, companyName: "Acme Fintech" }] }), // stage 1
      JSON.stringify({ resolutions: [{ companyName: "Acme Fintech", resultIndex: 1 }] }), // stage 2: picks the real site, not the LinkedIn result at index 0
    ]);

    const provider = new TavilySourcingProvider("tvly-test-key", ai);
    const results = await provider.findCompanies(baseQuery);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [resolutionUrl, resolutionInit] = fetchMock.mock.calls[1]!;
    expect(resolutionUrl).toBe("https://api.tavily.com/search");
    expect(JSON.parse(resolutionInit.body).query).toBe('"Acme Fintech" official website');
    expect(JSON.parse(resolutionInit.body).exclude_domains).toContain("linkedin.com");

    expect(results).toEqual([
      {
        companyName: "Acme Fintech",
        website: "https://acmefintech.com",
        industry: "Fintech",
        location: "Nigeria",
        notes: "Acme Fintech builds payment infrastructure.",
        sourceRef: "https://acmefintech.com",
        confidence: 0.6,
      },
    ]);
  });

  it("returns [] without any AI call when the discovery search finds nothing", async () => {
    const fetchMock = stubFetchSequence([{ results: [] }]);
    const ai = queuedAIProvider([JSON.stringify({ candidates: [] })]);

    const results = await new TavilySourcingProvider("k", ai).findCompanies(baseQuery);

    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it("returns [] without any resolution search when extraction finds no real companies", async () => {
    const fetchMock = stubFetchSequence([discoveryResults]);
    const ai = queuedAIProvider([JSON.stringify({ candidates: [] })]);

    const results = await new TavilySourcingProvider("k", ai).findCompanies(baseQuery);

    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // discovery only, no resolution searches
    expect(ai.generateJson).toHaveBeenCalledTimes(1); // stage 1 only, no stage 2 call
  });

  it("drops a company with no good resolution rather than forcing a weak match", async () => {
    stubFetchSequence([discoveryResults, { results: [] }]); // resolution search finds nothing for this company
    const ai = queuedAIProvider([
      JSON.stringify({ candidates: [{ resultIndex: 0, companyName: "Acme Fintech" }] }),
      JSON.stringify({ resolutions: [] }), // model correctly declines to force a match
    ]);

    const results = await new TavilySourcingProvider("k", ai).findCompanies(baseQuery);

    expect(results).toEqual([]);
  });

  it("stage 1: an out-of-range resultIndex fails validation and triggers the repair-retry loop", async () => {
    stubFetchSequence([discoveryResults, acmeResolutionResults]);
    const ai = queuedAIProvider([
      JSON.stringify({ candidates: [{ resultIndex: 99, companyName: "Bogus Co" }] }), // out of range -- rejected
      JSON.stringify({ candidates: [{ resultIndex: 0, companyName: "Acme Fintech" }] }), // repaired
      JSON.stringify({ resolutions: [{ companyName: "Acme Fintech", resultIndex: 1 }] }),
    ]);

    const results = await new TavilySourcingProvider("k", ai).findCompanies(baseQuery);

    expect(results).toHaveLength(1);
    expect(results[0]!.companyName).toBe("Acme Fintech");
  });

  it("stage 2: a resultIndex belonging to a different company's block fails validation and triggers repair-retry", async () => {
    stubFetchSequence([discoveryResults, acmeResolutionResults]);
    const ai = queuedAIProvider([
      JSON.stringify({ candidates: [{ resultIndex: 0, companyName: "Acme Fintech" }] }),
      JSON.stringify({ resolutions: [{ companyName: "Acme Fintech", resultIndex: 47 }] }), // not one of Acme's own indexes
      JSON.stringify({ resolutions: [{ companyName: "Acme Fintech", resultIndex: 1 }] }), // repaired
    ]);

    const results = await new TavilySourcingProvider("k", ai).findCompanies(baseQuery);

    expect(results).toHaveLength(1);
    expect(results[0]!.website).toBe("https://acmefintech.com");
  });

  it("de-dupes repeated company names from stage 1 before issuing resolution searches", async () => {
    const fetchMock = stubFetchSequence([discoveryResults, acmeResolutionResults]);
    const ai = queuedAIProvider([
      JSON.stringify({
        candidates: [
          { resultIndex: 0, companyName: "Acme Fintech" },
          { resultIndex: 0, companyName: "acme fintech" }, // same company, different case
        ],
      }),
      JSON.stringify({ resolutions: [{ companyName: "Acme Fintech", resultIndex: 1 }] }),
    ]);

    await new TavilySourcingProvider("k", ai).findCompanies(baseQuery);

    expect(fetchMock).toHaveBeenCalledTimes(2); // 1 discovery + 1 resolution search, not 2
  });

  it("throws with response detail on a non-ok Tavily response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "Invalid API key" });
    vi.stubGlobal("fetch", fetchMock);
    const ai = queuedAIProvider([JSON.stringify({ candidates: [] })]);

    await expect(new TavilySourcingProvider("bad-key", ai).findCompanies(baseQuery)).rejects.toThrow(/401/);
  });
});
