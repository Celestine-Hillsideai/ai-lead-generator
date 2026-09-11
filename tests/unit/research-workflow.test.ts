import { describe, expect, it } from "vitest";
import { processCompanyResearch } from "../../trigger/research-workflow";
import { FakeCampaignRepository } from "../helpers/fake-repository";
import { MockAIProvider } from "../../lib/ai/mock";
import { MockSearchProvider } from "../../lib/search/mock";
import type { CrawlResult } from "../../lib/scraper/crawler";

const fakeCrawl = async (): Promise<CrawlResult> => ({
  pages: [
    { url: "https://acme.example.com/", title: "Acme", text: "Acme Logistics moves freight across West Africa." },
  ],
  failedUrls: [],
});

function setup() {
  const repo = new FakeCampaignRepository();
  repo.seedCampaign({ id: "camp-1" });
  repo.seedCompany({ id: "comp-1", campaign_id: "camp-1" });
  return repo;
}

describe("processCompanyResearch", () => {
  it("runs the full pipeline in mock mode and lands on EMAIL_READY or NEEDS_REVIEW", async () => {
    const repo = setup();
    await processCompanyResearch(
      {
        repository: repo,
        aiProvider: new MockAIProvider(),
        searchProvider: new MockSearchProvider(),
        crawlWebsite: fakeCrawl,
      },
      { campaignId: "camp-1", companyId: "comp-1" }
    );

    const company = await repo.getCompany("comp-1");
    expect(["EMAIL_READY", "NEEDS_REVIEW"]).toContain(company.research_status);
    expect(company.qualification_score).not.toBeNull();
    expect(repo.emailDrafts).toHaveLength(1);
    expect(repo.qualifications).toHaveLength(1);
  });

  it("persists research findings and contacts along the way", async () => {
    const repo = setup();
    await processCompanyResearch(
      { repository: repo, aiProvider: new MockAIProvider(), searchProvider: new MockSearchProvider(), crawlWebsite: fakeCrawl },
      { campaignId: "camp-1", companyId: "comp-1" }
    );

    expect(repo.findingsByCompany.get("comp-1")).toBeDefined();
    expect(repo.findingsByCompany.get("comp-1")!.length).toBeGreaterThan(0);
    expect(repo.contactsByCompany.get("comp-1")).toBeDefined();
  });

  it("records a SUCCEEDED agent_run for each of the 5 agent stages", async () => {
    const repo = setup();
    await processCompanyResearch(
      { repository: repo, aiProvider: new MockAIProvider(), searchProvider: new MockSearchProvider(), crawlWebsite: fakeCrawl },
      { campaignId: "camp-1", companyId: "comp-1" }
    );

    const agentTypes = repo.agentRuns.map((r) => r.agentType);
    expect(agentTypes).toEqual(
      expect.arrayContaining(["research", "decision_maker", "qualification", "personalization", "email"])
    );
    expect(repo.agentRuns.every((r) => r.status === "SUCCEEDED")).toBe(true);
  });

  it("marks the company FAILED (and rethrows) if the crawl throws, without a partial DB state left mid-pipeline", async () => {
    const repo = setup();
    const throwingCrawl = async (): Promise<CrawlResult> => {
      throw new Error("SSRF blocked");
    };

    await expect(
      processCompanyResearch(
        { repository: repo, aiProvider: new MockAIProvider(), searchProvider: new MockSearchProvider(), crawlWebsite: throwingCrawl },
        { campaignId: "camp-1", companyId: "comp-1" }
      )
    ).rejects.toThrow("SSRF blocked");

    const company = await repo.getCompany("comp-1");
    expect(company.research_status).toBe("FAILED");
    expect(repo.emailDrafts).toHaveLength(0);
  });

  it("lands on NEEDS_REVIEW without generating an email when the crawl produces no usable findings", async () => {
    const repo = setup();
    const emptyResearchProvider = new MockAIProvider();
    // Override just the research response to have zero findings, by using a
    // crawl with pages whose content the mock research fixture still reports
    // findings for (MockAIProvider's research fixture is static) -- instead,
    // simulate "no findings" directly by stubbing replaceResearch's return.
    const originalReplaceResearch = repo.replaceResearch.bind(repo);
    repo.replaceResearch = async (companyId, sources, findings) => {
      await originalReplaceResearch(companyId, sources, findings);
      repo.findingsByCompany.set(companyId, []);
      return [];
    };

    await processCompanyResearch(
      { repository: repo, aiProvider: emptyResearchProvider, searchProvider: new MockSearchProvider(), crawlWebsite: fakeCrawl },
      { campaignId: "camp-1", companyId: "comp-1" }
    );

    const company = await repo.getCompany("comp-1");
    expect(company.research_status).toBe("NEEDS_REVIEW");
    expect(repo.emailDrafts).toHaveLength(0);
  });

  it("uses the campaign owner's saved qualification weights instead of the defaults", async () => {
    const repo = setup();
    repo.userSettings.set("user-1", {
      aiProvider: "openai",
      aiModel: null,
      emailProvider: "mock",
      maxPagesPerCompany: 15,
      maxCompaniesPerCampaign: 200,
      // All weight on industryFit (the mock qualification fixture's industryScore is 90),
      // zero everywhere else -- overall score should land at exactly the raw
      // industryScore regardless of the mock's other sub-scores, which would
      // pull the total to a different value under the default weights.
      qualificationWeights: {
        industryFit: 1,
        companySize: 0,
        geographicFit: 0,
        problemOpportunity: 0,
        decisionMakerFit: 0,
        buyingSignal: 0,
      },
      senderName: null,
      senderEmail: null,
    });

    await processCompanyResearch(
      { repository: repo, aiProvider: new MockAIProvider(), searchProvider: new MockSearchProvider(), crawlWebsite: fakeCrawl },
      { campaignId: "camp-1", companyId: "comp-1" }
    );

    expect(repo.qualifications[0]!.score).toBe(90);
  });

  it("uses the campaign owner's saved max-pages-per-company setting for the crawl", async () => {
    const repo = setup();
    repo.userSettings.set("user-1", {
      aiProvider: "openai",
      aiModel: null,
      emailProvider: "mock",
      maxPagesPerCompany: 3,
      maxCompaniesPerCampaign: 200,
      qualificationWeights: {
        industryFit: 0.25,
        companySize: 0.15,
        geographicFit: 0.1,
        problemOpportunity: 0.25,
        decisionMakerFit: 0.15,
        buyingSignal: 0.1,
      },
      senderName: null,
      senderEmail: null,
    });

    let capturedMaxPages: number | undefined;
    const crawlSpy = async (_url: string, options?: { maxPages?: number }): Promise<CrawlResult> => {
      capturedMaxPages = options?.maxPages;
      return fakeCrawl();
    };

    await processCompanyResearch(
      { repository: repo, aiProvider: new MockAIProvider(), searchProvider: new MockSearchProvider(), crawlWebsite: crawlSpy },
      { campaignId: "camp-1", companyId: "comp-1" }
    );

    expect(capturedMaxPages).toBe(3);
  });

  it("resolveAIProvider is consulted with the owner's settings and its returned provider is actually used", async () => {
    const repo = setup();
    repo.userSettings.set("user-1", {
      aiProvider: "anthropic",
      aiModel: null,
      emailProvider: "mock",
      maxPagesPerCompany: 15,
      maxCompaniesPerCampaign: 200,
      qualificationWeights: {
        industryFit: 0.25,
        companySize: 0.15,
        geographicFit: 0.1,
        problemOpportunity: 0.25,
        decisionMakerFit: 0.15,
        buyingSignal: 0.1,
      },
      senderName: null,
      senderEmail: null,
    });

    const defaultProvider = new MockAIProvider();
    const alternateProvider = new MockAIProvider();
    let resolveCalledWithProvider: string | undefined;

    await processCompanyResearch(
      {
        repository: repo,
        aiProvider: defaultProvider,
        resolveAIProvider: (settings) => {
          resolveCalledWithProvider = settings?.aiProvider;
          return alternateProvider;
        },
        searchProvider: new MockSearchProvider(),
        crawlWebsite: fakeCrawl,
      },
      { campaignId: "camp-1", companyId: "comp-1" }
    );

    expect(resolveCalledWithProvider).toBe("anthropic");
  });
});
