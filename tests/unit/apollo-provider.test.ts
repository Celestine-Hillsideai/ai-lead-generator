import { describe, expect, it, vi, afterEach } from "vitest";
import { ApolloSourcingProvider, parseEmployeeRange } from "../../lib/sourcing/apollo";
import type { CompanySourcingQuery } from "../../lib/sourcing/types";

const baseQuery: CompanySourcingQuery = {
  industry: "Fintech",
  geography: "United States",
  companySize: "50-200 employees",
  targetRoles: ["CEO"],
  offerDescription: null,
  targetCount: 10,
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

describe("parseEmployeeRange", () => {
  it("parses a two-number range regardless of order", () => {
    expect(parseEmployeeRange("50-200 employees")).toBe("50,200");
    expect(parseEmployeeRange("1,000-5,000")).toBe("1000,5000");
  });

  it("returns null when it can't find exactly two numbers", () => {
    expect(parseEmployeeRange("500+ employees")).toBeNull();
    expect(parseEmployeeRange("enterprise")).toBeNull();
    expect(parseEmployeeRange(null)).toBeNull();
  });
});

describe("ApolloSourcingProvider", () => {
  it("calls the Apollo organization-search endpoint with the API key and maps results", async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: {
        organizations: [
          {
            id: "org-1",
            name: "Acme Fintech",
            website_url: "https://acmefintech.com",
            primary_domain: "acmefintech.com",
            industry: "financial services",
            estimated_num_employees: 120,
            city: "New York",
            state: "NY",
            country: "United States",
            short_description: "A fintech company.",
          },
        ],
      },
    });

    const provider = new ApolloSourcingProvider("test-key");
    const results = await provider.findCompanies(baseQuery);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.apollo.io/api/v1/mixed_companies/search");
    expect(init.headers["x-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body.organization_locations).toEqual(["United States"]);
    expect(body.q_organization_keyword_tags).toEqual(["Fintech"]);
    expect(body.organization_num_employees_ranges).toEqual(["50,200"]);
    expect(body.per_page).toBe(10);

    expect(results).toEqual([
      {
        companyName: "Acme Fintech",
        website: "https://acmefintech.com",
        industry: "financial services",
        location: "New York, NY, United States",
        notes: "A fintech company.",
        sourceRef: "apollo://organizations/org-1",
        confidence: 0.8,
      },
    ]);
  });

  it("falls back to primary_domain when website_url is missing", async () => {
    stubFetch({
      ok: true,
      json: { organizations: [{ id: "org-2", name: "No Website Co", website_url: null, primary_domain: "nowebsite.co" }] },
    });

    const provider = new ApolloSourcingProvider("test-key");
    const [result] = await provider.findCompanies(baseQuery);

    expect(result!.website).toBe("https://nowebsite.co");
  });

  it("throws with response detail on a non-ok response (e.g. 403 plan-tier restriction)", async () => {
    stubFetch({ ok: false, status: 403, text: "Forbidden: upgrade your plan" });

    const provider = new ApolloSourcingProvider("test-key");
    await expect(provider.findCompanies(baseQuery)).rejects.toThrow(/403/);
  });

  it("omits the employee-range filter when companySize can't be parsed", async () => {
    const fetchMock = stubFetch({ ok: true, json: { organizations: [] } });

    const provider = new ApolloSourcingProvider("test-key");
    await provider.findCompanies({ ...baseQuery, companySize: "500+ employees" });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.organization_num_employees_ranges).toBeUndefined();
  });
});
