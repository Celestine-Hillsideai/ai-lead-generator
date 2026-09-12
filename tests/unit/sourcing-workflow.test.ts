import { describe, expect, it } from "vitest";
import { processSourcingRun } from "../../trigger/sourcing-workflow";
import { FakeCampaignRepository } from "../helpers/fake-repository";
import type { CompanySourcingProvider, SourcedCompanyCandidate } from "../../lib/sourcing/types";

function fakeProvider(candidates: SourcedCompanyCandidate[]): CompanySourcingProvider {
  return {
    name: "fake",
    findCompanies: async () => candidates,
  };
}

function candidate(overrides: Partial<SourcedCompanyCandidate> = {}): SourcedCompanyCandidate {
  return {
    companyName: "Acme Co",
    website: "https://acme.example.com",
    industry: "Fintech",
    location: "Lagos",
    notes: null,
    sourceRef: "fake://1",
    confidence: 0.8,
    ...overrides,
  };
}

describe("processSourcingRun", () => {
  it("inserts discovered candidates as auto_sourced companies and marks the run SUCCEEDED", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1" });
    const run = repo.seedSourcingRun({ id: "run-1", campaign_id: "camp-1", target_count: 5 });

    const provider = fakeProvider([
      candidate({ companyName: "Acme", website: "https://acme.example.com", sourceRef: "fake://1" }),
      candidate({ companyName: "Beta", website: "https://beta.example.com", sourceRef: "fake://2" }),
    ]);

    const result = await processSourcingRun({ repository: repo, sourcingProvider: provider }, { sourcingRunId: run.id });

    expect(result).toEqual({ discovered: 2, inserted: 2, skipped: 0 });
    const inserted = Array.from(repo.companies.values()).filter((c) => c.campaign_id === "camp-1");
    expect(inserted).toHaveLength(2);
    expect(inserted.every((c) => c.source_type === "auto_sourced")).toBe(true);
    expect(inserted.every((c) => c.sourcing_run_id === "run-1")).toBe(true);
    expect(inserted.every((c) => c.research_status === "IMPORTED")).toBe(true);
    expect(repo.sourcingRuns.get("run-1")!.status).toBe("SUCCEEDED");
    expect(repo.sourcingRuns.get("run-1")!.inserted_count).toBe(2);
  });

  it("skips a candidate already present for the campaign (cross-run dedup)", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1" });
    repo.seedCompany({ id: "existing", campaign_id: "camp-1", normalized_domain: "acme.example.com" });
    const run = repo.seedSourcingRun({ id: "run-1", campaign_id: "camp-1", target_count: 5 });

    const provider = fakeProvider([candidate({ website: "https://acme.example.com", sourceRef: "fake://1" })]);
    const result = await processSourcingRun({ repository: repo, sourcingProvider: provider }, { sourcingRunId: run.id });

    expect(result).toEqual({ discovered: 1, inserted: 0, skipped: 1 });
  });

  it("skips duplicates within the same batch, keeping only the first", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1" });
    const run = repo.seedSourcingRun({ id: "run-1", campaign_id: "camp-1", target_count: 5 });

    const provider = fakeProvider([
      candidate({ companyName: "Acme A", website: "https://acme.example.com", sourceRef: "fake://1" }),
      candidate({ companyName: "Acme B", website: "https://acme.example.com", sourceRef: "fake://2" }),
    ]);
    const result = await processSourcingRun({ repository: repo, sourcingProvider: provider }, { sourcingRunId: run.id });

    expect(result).toEqual({ discovered: 2, inserted: 1, skipped: 1 });
    const inserted = Array.from(repo.companies.values()).filter((c) => c.campaign_id === "camp-1");
    expect(inserted[0]!.name).toBe("Acme A");
  });

  it("isolates an invalid candidate (unparseable website) without aborting the run", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1" });
    const run = repo.seedSourcingRun({ id: "run-1", campaign_id: "camp-1", target_count: 5 });

    const provider = fakeProvider([
      candidate({ companyName: "Good Co", website: "https://good.example.com", sourceRef: "fake://1" }),
      candidate({ companyName: "Bad Co", website: "not a url", sourceRef: "fake://2" }),
      candidate({ companyName: "", website: "https://blank.example.com", sourceRef: "fake://3" }),
    ]);
    const result = await processSourcingRun({ repository: repo, sourcingProvider: provider }, { sourcingRunId: run.id });

    expect(result).toEqual({ discovered: 3, inserted: 1, skipped: 2 });
  });

  it("clamps the effective target to remaining campaign capacity and never calls the provider when capacity is exhausted", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1" });
    repo.userSettings.set("user-1", {
      aiProvider: "openai",
      aiModel: null,
      emailProvider: "mock",
      maxPagesPerCompany: 15,
      maxCompaniesPerCampaign: 1,
      maxCompaniesPerSourcingRun: 50,
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
    repo.seedCompany({ id: "existing", campaign_id: "camp-1" }); // already at the cap of 1
    const run = repo.seedSourcingRun({ id: "run-1", campaign_id: "camp-1", target_count: 5 });

    let providerCalled = false;
    const provider: CompanySourcingProvider = {
      name: "fake",
      findCompanies: async () => {
        providerCalled = true;
        return [];
      },
    };

    const result = await processSourcingRun({ repository: repo, sourcingProvider: provider }, { sourcingRunId: run.id });

    expect(providerCalled).toBe(false);
    expect(result).toEqual({ discovered: 0, inserted: 0, skipped: 0 });
    expect(repo.sourcingRuns.get("run-1")!.status).toBe("SUCCEEDED");
  });

  it("marks the run FAILED and rethrows when the provider throws, without touching existing companies", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1" });
    const run = repo.seedSourcingRun({ id: "run-1", campaign_id: "camp-1", target_count: 5 });

    const provider: CompanySourcingProvider = {
      name: "fake",
      findCompanies: async () => {
        throw new Error("provider is down");
      },
    };

    await expect(processSourcingRun({ repository: repo, sourcingProvider: provider }, { sourcingRunId: run.id })).rejects.toThrow(
      "provider is down"
    );

    expect(repo.sourcingRuns.get("run-1")!.status).toBe("FAILED");
    expect(repo.sourcingRuns.get("run-1")!.error).toBe("provider is down");
    expect(Array.from(repo.companies.values()).filter((c) => c.campaign_id === "camp-1")).toHaveLength(0);
  });

  it("uses the campaign owner's saved maxCompaniesPerSourcingRun to clamp the provider query", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1", user_id: "user-1" });
    repo.userSettings.set("user-1", {
      aiProvider: "openai",
      aiModel: null,
      emailProvider: "mock",
      maxPagesPerCompany: 15,
      maxCompaniesPerCampaign: 200,
      maxCompaniesPerSourcingRun: 2,
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
    const run = repo.seedSourcingRun({ id: "run-1", campaign_id: "camp-1", target_count: 20 });

    let receivedTargetCount = -1;
    const provider: CompanySourcingProvider = {
      name: "fake",
      findCompanies: async (query) => {
        receivedTargetCount = query.targetCount;
        return [];
      },
    };

    await processSourcingRun({ repository: repo, sourcingProvider: provider }, { sourcingRunId: run.id });

    expect(receivedTargetCount).toBe(2);
  });
});
