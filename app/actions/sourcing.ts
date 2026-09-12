"use server";

import { revalidatePath } from "next/cache";
import { tasks } from "@trigger.dev/sdk";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type { companySourcingWorkflow } from "../../trigger/sourcing-workflow";

export interface StartSourcingResult {
  error?: string;
  sourcingRunId?: string;
}

/**
 * Kicks off automated company sourcing for a campaign, per docs/spec.md
 * §11A. Fire-and-forget trigger, mirroring startProcessingAction
 * (app/actions/campaigns.ts) -- the actual discovery/insert work happens in
 * trigger/sourcing-workflow.ts, and the frontend polls the sourcing_runs
 * row (see getSourcingRunStatusAction below) for progress rather than
 * waiting on this call.
 */
export async function startCompanySourcingAction(
  campaignId: string,
  formData: FormData
): Promise<StartSourcingResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const targetCount = Number(formData.get("targetCount"));
  if (!Number.isFinite(targetCount) || targetCount <= 0) {
    return { error: "Target count must be a positive number." };
  }

  const { data: run, error } = await supabase
    .from("sourcing_runs")
    .insert({
      campaign_id: campaignId,
      requested_by: user.id,
      // The real provider name is only known once trigger/sourcing-workflow.ts
      // resolves getCompanySourcingProvider() in its own (Trigger.dev)
      // environment -- this is overwritten there before the run completes.
      provider: "pending",
      target_count: targetCount,
      status: "PENDING",
    })
    .select("id")
    .single();
  if (error || !run) return { error: error?.message ?? "Failed to start sourcing run." };

  try {
    await tasks.trigger<typeof companySourcingWorkflow>("company-sourcing-workflow", { sourcingRunId: run.id });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to start sourcing run." };
  }

  revalidatePath(`/campaigns/${campaignId}/leads`);
  return { sourcingRunId: run.id };
}

export interface SourcingRunStatus {
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  discoveredCount: number;
  insertedCount: number;
  skippedCount: number;
  error: string | null;
}

export async function getSourcingRunStatusAction(sourcingRunId: string): Promise<SourcingRunStatus | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sourcing_runs")
    .select("status, discovered_count, inserted_count, skipped_count, error")
    .eq("id", sourcingRunId)
    .single();
  if (error || !data) return { error: error?.message ?? "Sourcing run not found." };

  return {
    status: data.status as SourcingRunStatus["status"],
    discoveredCount: data.discovered_count,
    insertedCount: data.inserted_count,
    skippedCount: data.skipped_count,
    error: data.error,
  };
}
