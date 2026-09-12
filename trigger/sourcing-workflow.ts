import { task } from "@trigger.dev/sdk";
import { getSupabaseServiceClient } from "../lib/database/client";
import { SupabaseCampaignRepository } from "../lib/database/supabase-repository";
import type { CampaignPipelineRepository, CompanySourcingRepository } from "../lib/database/repository";
import { getCompanySourcingProvider } from "../lib/sourcing";
import type { CompanySourcingProvider } from "../lib/sourcing/types";
import { normalizeDomain } from "../lib/validation/csv";
import { dedupeByDomain } from "../lib/leads/dedupe";

/**
 * Automated company sourcing, per docs/spec.md §11A: discovers companies
 * matching a campaign's ICP and inserts them into `companies` in the exact
 * same shape/status ("IMPORTED") CSV import produces, so
 * trigger/research-workflow.ts picks them up unchanged. Exported as a plain
 * function for unit testing -- see tests/unit/sourcing-workflow.test.ts --
 * mirroring trigger/campaign-workflow.ts's shape.
 */

export interface SourcingWorkflowDeps {
  repository: CampaignPipelineRepository & CompanySourcingRepository;
  sourcingProvider: CompanySourcingProvider;
}

export interface SourcingWorkflowPayload {
  sourcingRunId: string;
}

export interface SourcingWorkflowResult {
  discovered: number;
  inserted: number;
  skipped: number;
}

export async function processSourcingRun(
  deps: SourcingWorkflowDeps,
  payload: SourcingWorkflowPayload
): Promise<SourcingWorkflowResult> {
  const { repository: repo } = deps;

  const run = await repo.getSourcingRun(payload.sourcingRunId);
  await repo.updateSourcingRunStatus(run.id, { status: "RUNNING", provider: deps.sourcingProvider.name });

  const campaign = await repo.getCampaign(run.campaign_id);
  const settings = await repo.getUserSettings(campaign.user_id);

  const maxPerRun = settings?.maxCompaniesPerSourcingRun ?? Number(process.env.MAX_COMPANIES_PER_SOURCING_RUN ?? 50);
  const maxPerCampaign = settings?.maxCompaniesPerCampaign ?? Number(process.env.MAX_COMPANIES_PER_CAMPAIGN ?? 200);
  const existingCount = await repo.countCompaniesForCampaign(campaign.id);
  const remainingCapacity = maxPerCampaign - existingCount;
  const effectiveTarget = Math.min(run.target_count, maxPerRun, remainingCapacity);

  if (effectiveTarget <= 0) {
    await repo.updateSourcingRunStatus(run.id, {
      status: "SUCCEEDED",
      discoveredCount: 0,
      insertedCount: 0,
      skippedCount: 0,
      completedAt: new Date().toISOString(),
    });
    return { discovered: 0, inserted: 0, skipped: 0 };
  }

  let candidates: Awaited<ReturnType<CompanySourcingProvider["findCompanies"]>>;
  try {
    candidates = await deps.sourcingProvider.findCompanies({
      industry: campaign.industry,
      geography: campaign.geography,
      companySize: campaign.company_size,
      targetRoles: campaign.target_roles,
      offerDescription: campaign.offer_description,
      targetCount: effectiveTarget,
    });
  } catch (err) {
    await repo.updateSourcingRunStatus(run.id, {
      status: "FAILED",
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date().toISOString(),
    });
    throw err; // rethrow so Trigger.dev's own attempt/retry tracking still applies
  }

  let skipped = 0;
  const valid: { normalizedDomain: string; candidate: (typeof candidates)[number] }[] = [];
  for (const candidate of candidates) {
    const domain = candidate.companyName.trim() ? normalizeDomain(candidate.website) : null;
    if (!domain) {
      skipped++;
      continue;
    }
    valid.push({ normalizedDomain: domain, candidate });
  }

  const existingDomains = new Set(await repo.getCompanyDomainsForCampaign(campaign.id));
  const { toInsert, duplicateCount } = dedupeByDomain(valid, existingDomains);
  skipped += duplicateCount;

  const capped = toInsert.slice(0, remainingCapacity);
  skipped += toInsert.length - capped.length;

  const insertedRows = await repo.insertSourcedCompanies(
    capped.map(({ normalizedDomain, candidate }) => ({
      campaignId: campaign.id,
      name: candidate.companyName,
      website: candidate.website,
      normalizedDomain,
      industry: candidate.industry,
      location: candidate.location,
      sourceProvider: deps.sourcingProvider.name,
      sourcingRunId: run.id,
    }))
  );

  await repo.updateSourcingRunStatus(run.id, {
    status: "SUCCEEDED",
    discoveredCount: candidates.length,
    insertedCount: insertedRows.length,
    skippedCount: skipped,
    completedAt: new Date().toISOString(),
  });

  return { discovered: candidates.length, inserted: insertedRows.length, skipped };
}

export const companySourcingWorkflow = task({
  id: "company-sourcing-workflow",
  retry: { maxAttempts: 2 },
  run: async (payload: SourcingWorkflowPayload) => {
    const db = getSupabaseServiceClient();
    return processSourcingRun(
      {
        repository: new SupabaseCampaignRepository(db),
        sourcingProvider: getCompanySourcingProvider(),
      },
      payload
    );
  },
});
