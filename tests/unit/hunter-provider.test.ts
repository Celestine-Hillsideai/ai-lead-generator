import { describe, expect, it, vi, afterEach } from "vitest";
import { HunterSearchProvider } from "../../lib/search/hunter";
import { FallbackSearchProvider } from "../../lib/search/index";
import type { DecisionMakerSearchQuery, DecisionMakerSearchResult, SearchProvider } from "../../lib/search/types";

const baseQuery: DecisionMakerSearchQuery = {
  companyName: "Paystack",
  companyDomain: "paystack.com",
  targetRoles: ["CEO"],
};

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

describe("HunterSearchProvider", () => {
  it("maps Hunter's structured response directly, no AI/text extraction involved", async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: {
        data: {
          emails: [
            {
              value: "kristin@paystack.com",
              first_name: "Kristin",
              last_name: "Clarke",
              position: "Head of People",
              position_raw: "Head of People",
              linkedin: "https://www.linkedin.com/in/kristin-clarke-8414296",
              sources: [{ uri: "https://www.google.com/search?q=site:linkedin.com" }],
              confidence: 85,
              verification: { status: "valid" },
            },
          ],
        },
      },
    });

    const provider = new HunterSearchProvider("hunter-test-key");
    const results = await provider.findDecisionMakers(baseQuery);

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toContain("domain=paystack.com");
    expect(url).toContain("api_key=hunter-test-key");

    expect(results).toEqual([
      {
        fullName: "Kristin Clarke",
        title: "Head of People",
        email: "kristin@paystack.com",
        emailStatus: "verified",
        sourceUrl: "https://www.linkedin.com/in/kristin-clarke-8414296",
        confidence: 0.85,
      },
    ]);
  });

  it("maps verification statuses correctly", async () => {
    const entries = [
      { status: "valid", expected: "verified" },
      { status: "accept_all", expected: "unverified" },
      { status: "webmail", expected: "unverified" },
      { status: "invalid", expected: "invalid" },
      { status: "disposable", expected: "invalid" },
      { status: null, expected: "unknown" },
      { status: "something_new_hunter_adds_later", expected: "unknown" },
    ] as const;

    for (const { status, expected } of entries) {
      stubFetch({
        ok: true,
        json: {
          data: {
            emails: [
              {
                value: "a@b.com",
                first_name: "A",
                last_name: "B",
                position: null,
                position_raw: null,
                linkedin: null,
                sources: [],
                confidence: 50,
                verification: { status },
              },
            ],
          },
        },
      });
      const [result] = await new HunterSearchProvider("k").findDecisionMakers(baseQuery);
      expect(result!.emailStatus).toBe(expected);
    }
  });

  it("falls back to the email itself as fullName when Hunter has no name attached", async () => {
    stubFetch({
      ok: true,
      json: {
        data: {
          emails: [
            {
              value: "info@paystack.com",
              first_name: null,
              last_name: null,
              position: null,
              position_raw: null,
              linkedin: null,
              sources: [],
              confidence: 40,
              verification: { status: "unknown" },
            },
          ],
        },
      },
    });
    const [result] = await new HunterSearchProvider("k").findDecisionMakers(baseQuery);
    expect(result!.fullName).toBe("info@paystack.com");
  });

  it("returns [] when Hunter has nothing for a domain", async () => {
    stubFetch({ ok: true, json: { data: { emails: [] } } });
    const results = await new HunterSearchProvider("k").findDecisionMakers(baseQuery);
    expect(results).toEqual([]);
  });

  it("throws with response detail on a non-ok response", async () => {
    stubFetch({ ok: false, status: 401, text: "Invalid API key" });
    await expect(new HunterSearchProvider("bad-key").findDecisionMakers(baseQuery)).rejects.toThrow(/401/);
  });
});

function fakeProvider(name: string, results: DecisionMakerSearchResult[]): SearchProvider {
  return { name, findDecisionMakers: vi.fn(async () => results) };
}

const sampleResult: DecisionMakerSearchResult = {
  fullName: "Jane Doe",
  title: "CEO",
  email: "jane@example.com",
  emailStatus: "verified",
  sourceUrl: "https://example.com",
  confidence: 0.8,
};

describe("FallbackSearchProvider", () => {
  it("uses the primary's results and never calls secondary when primary finds something", async () => {
    const primary = fakeProvider("primary", [sampleResult]);
    const secondary = fakeProvider("secondary", []);

    const results = await new FallbackSearchProvider(primary, secondary).findDecisionMakers(baseQuery);

    expect(results).toEqual([sampleResult]);
    expect(secondary.findDecisionMakers).not.toHaveBeenCalled();
  });

  it("falls back to secondary when primary finds nothing", async () => {
    const primary = fakeProvider("primary", []);
    const secondary = fakeProvider("secondary", [sampleResult]);

    const results = await new FallbackSearchProvider(primary, secondary).findDecisionMakers(baseQuery);

    expect(results).toEqual([sampleResult]);
  });

  it("propagates a primary error instead of silently falling back", async () => {
    const primary: SearchProvider = {
      name: "primary",
      findDecisionMakers: vi.fn().mockRejectedValue(new Error("primary boom")),
    };
    const secondary = fakeProvider("secondary", [sampleResult]);

    await expect(new FallbackSearchProvider(primary, secondary).findDecisionMakers(baseQuery)).rejects.toThrow("primary boom");
    expect(secondary.findDecisionMakers).not.toHaveBeenCalled();
  });
});
