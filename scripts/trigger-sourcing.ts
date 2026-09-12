/**
 * CLI harness to fire a company-sourcing-workflow run without the frontend,
 * mirroring scripts/trigger-campaign.ts. Creates the sourcing_runs row
 * itself (app/actions/sourcing.ts's startCompanySourcingAction does this
 * via the RLS-scoped client normally; here we use the service client since
 * there's no signed-in user in a CLI context).
 *
 * Usage: npm run trigger:sourcing -- <campaignId> [targetCount]
 */

import { tasks } from "@trigger.dev/sdk";
import { getSupabaseServiceClient } from "../lib/database/client";
import type { companySourcingWorkflow } from "../trigger/sourcing-workflow";

async function main() {
  const campaignId = process.argv[2];
  const targetCount = Number(process.argv[3] ?? 10);
  if (!campaignId) {
    console.error("Usage: npm run trigger:sourcing -- <campaignId> [targetCount]");
    process.exit(1);
  }

  const db = getSupabaseServiceClient();
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .select("user_id")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaign) throw new Error(`Campaign ${campaignId} not found: ${campaignError?.message}`);

  const { data: run, error } = await db
    .from("sourcing_runs")
    .insert({
      campaign_id: campaignId,
      requested_by: campaign.user_id,
      provider: "pending",
      target_count: targetCount,
      status: "PENDING",
    })
    .select("id")
    .single();
  if (error || !run) throw new Error(`Failed to create sourcing run: ${error?.message}`);

  console.log(`Triggering company-sourcing-workflow for campaign ${campaignId} (sourcingRunId=${run.id})...`);
  const handle = await tasks.trigger<typeof companySourcingWorkflow>("company-sourcing-workflow", {
    sourcingRunId: run.id,
  });

  console.log(`Triggered run: ${handle.id}`);
  console.log("Watch it in the Trigger.dev dashboard, or the local dev CLI logs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
