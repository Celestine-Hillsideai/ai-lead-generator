import { describe, expect, it, vi, afterEach } from "vitest";
import type { AIProvider, GenerateJsonParams } from "../../lib/ai/types";
import { TavilySearchProvider } from "../../lib/search/tavily";
import type { DecisionMakerSearchQuery } from "../../lib/search/types";

const baseQuery: DecisionMakerSearchQuery = {
  companyName: "Acme Fintech",
  companyDomain: "acmefintech.com",
  targetRoles: ["CEO"],
};

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

const searchResults = {
  results: [
    { title: "Acme Fintech - Leadership", url: "https://acmefintech.com/about", content: "Our CEO Jane Smith leads the company. Contact: jane.smith@acmefintech.com" },
  ],
};

describe("TavilySearchProvider", () => {
  it("extracts a real candidate and keeps an email only if it literally appears in the source content", async () => {
    const fetchMock = stubFetch({ ok: true, json: searchResults });
    const ai = queuedAIProvider([
      JSON.stringify({ candidates: [{ resultIndex: 0, fullName: "Jane Smith", title: "CEO", email: "jane.smith@acmefintech.com" }] }),
    ]);

    const provider = new TavilySearchProvider("tvly-test-key", ai);
    const results = await provider.findDecisionMakers(baseQuery);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.tavily.com/search");
    const body = JSON.parse(init.body);
    expect(body.query).toContain("Acme Fintech");
    expect(body.include_domains).toEqual(["acmefintech.com"]);

    expect(results).toEqual([
      {
        fullName: "Jane Smith",
        title: "CEO",
        email: "jane.smith@acmefintech.com",
        emailStatus: "public",
        sourceUrl: "https://acmefintech.com/about",
        confidence: 0.6,
      },
    ]);
  });

  it("never surfaces an email the model invented, even if the schema accepts it: drops to null/unknown instead of trusting the model", async () => {
    stubFetch({ ok: true, json: searchResults });
    const ai = queuedAIProvider([
      JSON.stringify({
        candidates: [{ resultIndex: 0, fullName: "Jane Smith", title: "CEO", email: "jane.smith@somethingelse.com" }],
      }),
    ]);

    const provider = new TavilySearchProvider("k", ai);
    const [result] = await provider.findDecisionMakers(baseQuery);

    expect(result!.email).toBeNull();
    expect(result!.emailStatus).toBe("unknown");
  });

  it("returns [] without any AI call when the search finds nothing", async () => {
    const fetchMock = stubFetch({ ok: true, json: { results: [] } });
    const ai = queuedAIProvider([JSON.stringify({ candidates: [] })]);

    const results = await new TavilySearchProvider("k", ai).findDecisionMakers(baseQuery);

    expect(results).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ai.generateJson).not.toHaveBeenCalled();
  });

  it("an out-of-range resultIndex fails validation and triggers the repair-retry loop", async () => {
    stubFetch({ ok: true, json: searchResults });
    const ai = queuedAIProvider([
      JSON.stringify({ candidates: [{ resultIndex: 99, fullName: "Bogus Person", title: "CEO", email: null }] }),
      JSON.stringify({ candidates: [{ resultIndex: 0, fullName: "Jane Smith", title: "CEO", email: null }] }),
    ]);

    const results = await new TavilySearchProvider("k", ai).findDecisionMakers(baseQuery);

    expect(results).toHaveLength(1);
    expect(results[0]!.fullName).toBe("Jane Smith");
  });

  it("de-dupes repeated names", async () => {
    stubFetch({ ok: true, json: searchResults });
    const ai = queuedAIProvider([
      JSON.stringify({
        candidates: [
          { resultIndex: 0, fullName: "Jane Smith", title: "CEO", email: null },
          { resultIndex: 0, fullName: "jane smith", title: "Chief Executive Officer", email: null },
        ],
      }),
    ]);

    const results = await new TavilySearchProvider("k", ai).findDecisionMakers(baseQuery);

    expect(results).toHaveLength(1);
  });

  it("throws with response detail on a non-ok Tavily response", async () => {
    stubFetch({ ok: false, status: 401, text: "Invalid API key" });
    const ai = queuedAIProvider([JSON.stringify({ candidates: [] })]);

    await expect(new TavilySearchProvider("bad-key", ai).findDecisionMakers(baseQuery)).rejects.toThrow(/401/);
  });
});
