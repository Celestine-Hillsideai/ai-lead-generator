"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { userSettingsSchema } from "../../types/settings";

export interface SaveSettingsResult {
  error?: string;
  success?: boolean;
}

/**
 * Upserts the signed-in user's settings row (types/settings.ts,
 * supabase/migrations/20260911090000_settings_and_audit.sql). Consumed by
 * the pipeline: aiProvider/aiModel, qualificationWeights, and
 * maxPagesPerCompany/maxCompaniesPerCampaign (see
 * trigger/research-workflow.ts and trigger/campaign-workflow.ts);
 * emailProvider/senderName/senderEmail by app/actions/emails.ts's
 * sendEmailAction (see types/settings.ts).
 */
export async function saveSettingsAction(formData: FormData): Promise<SaveSettingsResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const rawWeights = {
    industryFit: Number(formData.get("industryFit")),
    companySize: Number(formData.get("companySize")),
    geographicFit: Number(formData.get("geographicFit")),
    problemOpportunity: Number(formData.get("problemOpportunity")),
    decisionMakerFit: Number(formData.get("decisionMakerFit")),
    buyingSignal: Number(formData.get("buyingSignal")),
  };

  const parsed = userSettingsSchema.safeParse({
    aiProvider: String(formData.get("aiProvider") ?? "openai"),
    aiModel: String(formData.get("aiModel") ?? "").trim() || null,
    emailProvider: String(formData.get("emailProvider") ?? "mock"),
    maxPagesPerCompany: Number(formData.get("maxPagesPerCompany")),
    maxCompaniesPerCampaign: Number(formData.get("maxCompaniesPerCampaign")),
    qualificationWeights: rawWeights,
    senderName: String(formData.get("senderName") ?? "").trim() || null,
    senderEmail: String(formData.get("senderEmail") ?? "").trim() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }

  const weightSum = Object.values(parsed.data.qualificationWeights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 0.01) {
    return { error: `Qualification weights must sum to 100% (currently ${Math.round(weightSum * 100)}%).` };
  }

  const { error } = await supabase.from("user_settings").upsert({
    user_id: user.id,
    ai_provider: parsed.data.aiProvider,
    ai_model: parsed.data.aiModel,
    email_provider: parsed.data.emailProvider,
    max_pages_per_company: parsed.data.maxPagesPerCompany,
    max_companies_per_campaign: parsed.data.maxCompaniesPerCampaign,
    qualification_weights: parsed.data.qualificationWeights,
    sender_name: parsed.data.senderName,
    sender_email: parsed.data.senderEmail,
    updated_at: new Date().toISOString(),
  });

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}
