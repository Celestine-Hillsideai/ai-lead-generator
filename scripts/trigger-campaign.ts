/**
 * CLI harness to fire a campaign-workflow run without a frontend.
 *
 * There's no Next.js app yet to call tasks.trigger() from a server action,
 * so this script is the stand-in for local/manual verification (B7/B8).
 * It uses the same tasks.trigger() call a future Next.js API route will use.
 *
 * Usage: npm run trigger:campaign -- <campaignId>
 */

import { tasks } from "@trigger.dev/sdk";
import type { campaignWorkflow } from "../trigger/campaign-workflow";

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId) {
    console.error("Usage: npm run trigger:campaign -- <campaignId>");
    process.exit(1);
  }

  console.log(`Triggering campaign-workflow for campaign ${campaignId}...`);
  const handle = await tasks.trigger<typeof campaignWorkflow>("campaign-workflow", {
    campaignId,
  });

  console.log(`Triggered run: ${handle.id}`);
  console.log("Watch it in the Trigger.dev dashboard, or the local dev CLI logs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
