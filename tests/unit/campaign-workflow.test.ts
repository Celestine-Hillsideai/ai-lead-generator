import { describe, expect, it } from "vitest";
import { processCampaign, type TriggerResearchResult } from "../../trigger/campaign-workflow";
import { FakeCampaignRepository } from "../helpers/fake-repository";

function seedCompanies(repo: FakeCampaignRepository, campaignId: string, count: number): string[] {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = `comp-${i}`;
    repo.seedCompany({ id, campaign_id: campaignId });
    ids.push(id);
  }
  return ids;
}

describe("processCampaign", () => {
  it("triggers every non-terminal company and tallies ok/failed results", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1", status: "PROCESSING" });
    const ids = seedCompanies(repo, "camp-1", 3);

    const triggered: { campaignId: string; companyId: string }[] = [];
    const result = await processCampaign(
      {
        repository: repo,
        triggerResearchBatch: async (items) => {
          triggered.push(...items);
          return items.map((item, i): TriggerResearchResult => ({
            companyId: item.companyId,
            ok: i !== 1, // second company in each batch "fails"
          }));
        },
      },
      { campaignId: "camp-1" }
    );

    expect(triggered.map((t) => t.companyId).sort()).toEqual(ids.sort());
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.paused).toBe(false);
  });

  it("chunks companies according to chunkSize", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1", status: "PROCESSING" });
    seedCompanies(repo, "camp-1", 5);

    const batchSizes: number[] = [];
    await processCampaign(
      {
        repository: repo,
        chunkSize: 2,
        triggerResearchBatch: async (items) => {
          batchSizes.push(items.length);
          return items.map((item): TriggerResearchResult => ({ companyId: item.companyId, ok: true }));
        },
      },
      { campaignId: "camp-1" }
    );

    expect(batchSizes).toEqual([2, 2, 1]);
  });

  it("stops between chunks (not mid-chunk) when the campaign is paused, leaving later companies untouched", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1", status: "PROCESSING" });
    seedCompanies(repo, "camp-1", 5);

    let batchesTriggered = 0;
    const result = await processCampaign(
      {
        repository: repo,
        chunkSize: 2,
        triggerResearchBatch: async (items) => {
          batchesTriggered++;
          if (batchesTriggered === 1) {
            // Simulate the user pausing the campaign mid-run.
            repo.campaigns.get("camp-1")!.status = "PAUSED";
          }
          return items.map((item): TriggerResearchResult => ({ companyId: item.companyId, ok: true }));
        },
      },
      { campaignId: "camp-1" }
    );

    expect(batchesTriggered).toBe(1);
    expect(result.paused).toBe(true);
    expect(result.processed).toBe(2);
  });

  it("respects maxCompanies (cost control, spec §28)", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1", status: "PROCESSING" });
    seedCompanies(repo, "camp-1", 10);

    let totalTriggered = 0;
    await processCampaign(
      {
        repository: repo,
        maxCompanies: 3,
        triggerResearchBatch: async (items) => {
          totalTriggered += items.length;
          return items.map((item): TriggerResearchResult => ({ companyId: item.companyId, ok: true }));
        },
      },
      { campaignId: "camp-1" }
    );

    expect(totalTriggered).toBe(3);
  });

  it("resume is idempotent: already-terminal companies aren't re-triggered", async () => {
    const repo = new FakeCampaignRepository();
    repo.seedCampaign({ id: "camp-1", status: "PROCESSING" });
    repo.seedCompany({ id: "comp-done", campaign_id: "camp-1", research_status: "EMAIL_READY" });
    repo.seedCompany({ id: "comp-pending", campaign_id: "camp-1", research_status: "IMPORTED" });

    const triggered: string[] = [];
    await processCampaign(
      {
        repository: repo,
        triggerResearchBatch: async (items) => {
          triggered.push(...items.map((i) => i.companyId));
          return items.map((item): TriggerResearchResult => ({ companyId: item.companyId, ok: true }));
        },
      },
      { campaignId: "camp-1" }
    );

    expect(triggered).toEqual(["comp-pending"]);
  });
});
