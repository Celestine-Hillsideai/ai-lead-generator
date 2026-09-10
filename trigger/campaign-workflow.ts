import { task, idempotencyKeys } from "@trigger.dev/sdk";
import { getSupabaseServiceClient } from "../lib/database/client";
import { SupabaseCampaignRepository } from "../lib/database/supabase-repository";
import type { CampaignPipelineRepository } from "../lib/database/repository";
import { researchWorkflow } from "./research-workflow";

/**
 * Campaign-level fan-out, per docs/spec.md §21, §28. Exported as a plain
 * function (not the task itself) so the chunking/pause/result-tallying
 * logic is unit-testable against a fake triggerResearchBatch -- see
 * tests/unit/campaign-workflow.test.ts. Real fan-out uses
 * researchWorkflow.batchTriggerAndWait, per workflows/00-architecture.md:
 * this gives per-company parallelism (bounded by research-workflow's own
 * queue.concurrencyLimit) and structural per-company failure isolation --
 * one company's {ok:false} result never throws the parent.
 */

export interface TriggerResearchResult {
  companyId: string;
  ok: boolean;
  error?: string;
}

export interface CampaignOrchestrationDeps {
  repository: CampaignPipelineRepository;
  triggerResearchBatch: (items: { campaignId: string; companyId: string }[]) => Promise<TriggerResearchResult[]>;
  /** Small chunks are the only pause-checkpoint granularity available -- see workflows/00-architecture.md. */
  chunkSize?: number;
  maxCompanies?: number;
}

export interface CampaignOrchestrationPayload {
  campaignId: string;
}

export interface CampaignOrchestrationResult {
  processed: number;
  failed: number;
  paused: boolean;
}

export async function processCampaign(
  deps: CampaignOrchestrationDeps,
  payload: CampaignOrchestrationPayload
): Promise<CampaignOrchestrationResult> {
  const chunkSize = deps.chunkSize ?? 20;
  const maxCompanies = deps.maxCompanies ?? Number(process.env.MAX_COMPANIES_PER_CAMPAIGN ?? 200);

  // Only non-terminal-status companies -- makes a resume (re-triggering with
  // the same campaignId) idempotent and cheap, per workflows/00-architecture.md.
  const companies = await deps.repository.getCompaniesToProcess(payload.campaignId, maxCompanies);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < companies.length; i += chunkSize) {
    if (await deps.repository.isCampaignPaused(payload.campaignId)) {
      return { processed, failed, paused: true };
    }

    const chunk = companies.slice(i, i + chunkSize);
    const results = await deps.triggerResearchBatch(
      chunk.map((c) => ({ campaignId: payload.campaignId, companyId: c.id }))
    );

    for (const result of results) {
      if (result.ok) processed++;
      else failed++;
    }
  }

  return { processed, failed, paused: false };
}

export const campaignWorkflow = task({
  id: "campaign-workflow",
  retry: { maxAttempts: 2 }, // orchestrator -- idempotency keys below make a retry safe, but this isn't the place to hammer-retry
  run: async (payload: CampaignOrchestrationPayload) => {
    const db = getSupabaseServiceClient();
    const repository = new SupabaseCampaignRepository(db);

    const result = await processCampaign(
      {
        repository,
        triggerResearchBatch: async (items) => {
          const batchResult = await researchWorkflow.batchTriggerAndWait(
            await Promise.all(
              items.map(async (item) => ({
                payload: item,
                options: { idempotencyKey: await idempotencyKeys.create(`research-${item.companyId}`) },
              }))
            )
          );
          return batchResult.runs.map((run, i) => ({
            companyId: items[i]!.companyId,
            ok: run.ok,
            error: run.ok ? undefined : String(run.error),
          }));
        },
      },
      payload
    );

    return result;
  },
});
