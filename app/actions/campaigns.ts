"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { tasks } from "@trigger.dev/sdk";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import type { campaignWorkflow } from "../../trigger/campaign-workflow";

export async function createCampaignAction(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Campaign name is required." };

  const targetRoles = String(formData.get("targetRoles") ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name,
      description: String(formData.get("description") ?? "") || null,
      industry: String(formData.get("industry") ?? "") || null,
      geography: String(formData.get("geography") ?? "") || null,
      company_size: String(formData.get("companySize") ?? "") || null,
      target_roles: targetRoles,
      offer_description: String(formData.get("offerDescription") ?? "") || null,
      value_proposition: String(formData.get("valueProposition") ?? "") || null,
      cta: String(formData.get("cta") ?? "") || null,
      research_instructions: String(formData.get("researchInstructions") ?? "") || null,
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (error || !campaign) return { error: error?.message ?? "Failed to create campaign." };

  redirect(`/campaigns/${campaign.id}`);
}

export async function startProcessingAction(campaignId: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { error: updateError } = await supabase
    .from("campaigns")
    .update({ status: "PROCESSING" })
    .eq("id", campaignId);
  if (updateError) return { error: updateError.message };

  try {
    await tasks.trigger<typeof campaignWorkflow>("campaign-workflow", { campaignId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to start processing." };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function pauseCampaignAction(campaignId: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("campaigns").update({ status: "PAUSED" }).eq("id", campaignId);
  if (error) return { error: error.message };
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function resumeCampaignAction(campaignId: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("campaigns").update({ status: "PROCESSING" }).eq("id", campaignId);
  if (error) return { error: error.message };

  try {
    await tasks.trigger<typeof campaignWorkflow>("campaign-workflow", { campaignId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to resume processing." };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}
