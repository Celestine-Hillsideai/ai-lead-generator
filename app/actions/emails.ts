"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getAIProvider } from "../../lib/ai";
import { getEmailProvider } from "../../lib/email";
import { checkSendEligibility } from "../../lib/email/send-guard";
import { runEmailAgent } from "../../agents/email-agent";
import type { PersonalizationOutput } from "../../types/contracts";
import type { Database } from "../../lib/database/types.generated";

/** Audit trail per docs/spec.md §19: "record approval/rejection timestamps and state changes." */
async function logEmailDraftEvent(
  supabase: SupabaseClient<Database>,
  emailDraftId: string,
  fromStatus: string | null,
  toStatus: string,
  actorUserId: string | null,
  note?: string
): Promise<void> {
  await supabase.from("email_draft_events").insert({
    email_draft_id: emailDraftId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_user_id: actorUserId,
    note: note ?? null,
  });
}

export async function approveEmailAction(emailDraftId: string, revalidatePathTarget: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: before } = await supabase.from("email_drafts").select("status").eq("id", emailDraftId).single();

  const { error } = await supabase.from("email_drafts").update({ status: "APPROVED" }).eq("id", emailDraftId);
  if (error) return { error: error.message };

  await logEmailDraftEvent(supabase, emailDraftId, before?.status ?? null, "APPROVED", user?.id ?? null);
  revalidatePath(revalidatePathTarget);
  return {};
}

export async function rejectEmailAction(emailDraftId: string, revalidatePathTarget: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: before } = await supabase.from("email_drafts").select("status").eq("id", emailDraftId).single();

  const { error } = await supabase.from("email_drafts").update({ status: "REJECTED" }).eq("id", emailDraftId);
  if (error) return { error: error.message };

  await logEmailDraftEvent(supabase, emailDraftId, before?.status ?? null, "REJECTED", user?.id ?? null);
  revalidatePath(revalidatePathTarget);
  return {};
}

/**
 * Bulk-approves multiple drafts at once, per docs/spec.md §19 ("Bulk
 * approval should be optional and restricted to high-confidence records").
 * The confidence floor is enforced server-side against the actual DB rows
 * -- a caller passing an id for a low-confidence draft just gets it
 * silently excluded from `approvedIds`, not an error, since the UI already
 * only lets the user select eligible rows (see components/leads/approval-queue.tsx).
 */
const BULK_APPROVE_MIN_CONFIDENCE = 0.8;

export async function bulkApproveEmailsAction(
  emailDraftIds: string[],
  revalidatePathTarget: string
): Promise<{ error?: string; approvedIds?: string[]; skippedIds?: string[] }> {
  if (emailDraftIds.length === 0) return { approvedIds: [], skippedIds: [] };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: drafts, error: fetchError } = await supabase
    .from("email_drafts")
    .select("id, status, confidence")
    .in("id", emailDraftIds);
  if (fetchError) return { error: fetchError.message };

  const eligible = (drafts ?? []).filter((d) => d.status === "READY" && (d.confidence ?? 0) >= BULK_APPROVE_MIN_CONFIDENCE);
  const skippedIds = emailDraftIds.filter((id) => !eligible.some((d) => d.id === id));

  if (eligible.length === 0) return { approvedIds: [], skippedIds };

  const { error: updateError } = await supabase
    .from("email_drafts")
    .update({ status: "APPROVED" })
    .in(
      "id",
      eligible.map((d) => d.id)
    );
  if (updateError) return { error: updateError.message };

  await Promise.all(
    eligible.map((d) =>
      logEmailDraftEvent(supabase, d.id, d.status, "APPROVED", user?.id ?? null, "bulk approval")
    )
  );

  revalidatePath(revalidatePathTarget);
  return { approvedIds: eligible.map((d) => d.id), skippedIds };
}

export async function editEmailAction(
  emailDraftId: string,
  updates: { subject: string; body: string },
  revalidatePathTarget: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: before } = await supabase.from("email_drafts").select("status").eq("id", emailDraftId).single();

  const { error } = await supabase
    .from("email_drafts")
    .update({ subject: updates.subject, body: updates.body })
    .eq("id", emailDraftId);
  if (error) return { error: error.message };

  await logEmailDraftEvent(supabase, emailDraftId, before?.status ?? null, before?.status ?? "READY", user?.id ?? null, "edited");
  revalidatePath(revalidatePathTarget);
  return {};
}

/**
 * Regenerates an email draft by re-running the Email Generation Agent
 * against the same evidence-backed personalization material (re-derived
 * from the draft's own evidenceIds, matching what agents/email-agent.ts
 * expects) -- never fabricates new evidence, just asks the model for a
 * fresh pass over the same verified material.
 */
export async function regenerateEmailAction(
  emailDraftId: string,
  revalidatePathTarget: string
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("id", emailDraftId)
    .single();
  if (draftError || !draft) return { error: draftError?.message ?? "Draft not found." };

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", draft.campaign_id).single();
  if (!campaign) return { error: "Campaign not found." };

  const { data: findings } = await supabase
    .from("research_findings")
    .select("*")
    .in("id", draft.evidence_ids.length > 0 ? draft.evidence_ids : ["00000000-0000-0000-0000-000000000000"]);
  if (!findings || findings.length === 0) {
    return { error: "No evidence findings available to regenerate from." };
  }

  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", draft.contact_id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  // Reconstruct a minimal PersonalizationOutput from the evidence -- each
  // finding becomes its own evidence-backed segment, since the original
  // per-segment breakdown (openingHook/businessObservation/opportunity)
  // isn't separately stored on the email draft, only the final composed
  // evidenceIds. This still guarantees every claim traces to real evidence.
  const personalization: PersonalizationOutput = {
    openingHook: { text: findings[0]!.claim, evidenceIds: [findings[0]!.id] },
    businessObservation: {
      text: findings[Math.min(1, findings.length - 1)]!.claim,
      evidenceIds: [findings[Math.min(1, findings.length - 1)]!.id],
    },
    opportunity: {
      text: findings[Math.min(2, findings.length - 1)]!.claim,
      evidenceIds: [findings[Math.min(2, findings.length - 1)]!.id],
    },
    valueConnection: { text: campaign.value_proposition ?? "", evidenceIds: [] },
    overallConfidence: 0.7,
  };

  try {
    const provider = getAIProvider();
    const email = await runEmailAgent(provider, {
      campaign: {
        offerDescription: campaign.offer_description,
        valueProposition: campaign.value_proposition,
        cta: campaign.cta,
        researchInstructions: campaign.research_instructions,
      },
      personalization,
      recipientFirstName: contact?.first_name ?? null,
    });

    const { error: updateError } = await supabase
      .from("email_drafts")
      .update({
        subject: email.subject,
        body: email.body,
        personalization_hook: email.personalizationHook,
        evidence_ids: email.evidenceIds,
        confidence: email.confidence,
        status: "READY",
      })
      .eq("id", emailDraftId);
    if (updateError) return { error: updateError.message };

    await logEmailDraftEvent(supabase, emailDraftId, draft.status, "READY", user?.id ?? null, "regenerated");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to regenerate email." };
  }

  revalidatePath(revalidatePathTarget);
  return {};
}

/**
 * Deletes an email draft outright (any status) -- distinct from Reject,
 * which keeps a REJECTED record for the audit trail. This is for a draft
 * the user considers noise entirely (e.g. a low-quality NEEDS_REVIEW
 * company they don't want cluttering the queue), not a rejection decision
 * worth remembering. email_draft_events rows for it cascade-delete with it.
 */
export async function deleteEmailDraftAction(emailDraftId: string, revalidatePathTarget: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("email_drafts").delete().eq("id", emailDraftId);
  if (error) return { error: error.message };

  revalidatePath(revalidatePathTarget);
  return {};
}

/**
 * Sends an already-approved draft through the configured EmailProvider, per
 * docs/spec.md §19 ("Only approved emails can be exported or sent") and §20
 * (provider abstraction, suppression/invalid-contact enforcement). Kept as
 * a distinct action from approveEmailAction rather than auto-sending on
 * approve -- spec §19 and CLAUDE.md's non-negotiables both frame approval
 * and sending as separate human-gated steps.
 */
export async function sendEmailAction(emailDraftId: string, revalidatePathTarget: string): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: draft, error: draftError } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("id", emailDraftId)
    .single();
  if (draftError || !draft) return { error: draftError?.message ?? "Draft not found." };

  if (draft.status !== "APPROVED") {
    return { error: "Only approved drafts can be sent." };
  }

  const { data: contactRow } = await supabase
    .from("contacts")
    .select("email, email_status")
    .eq("id", draft.contact_id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  const { data: suppressions } = await supabase
    .from("suppressions")
    .select("email")
    .or(`user_id.eq.${user?.id ?? "00000000-0000-0000-0000-000000000000"},campaign_id.eq.${draft.campaign_id}`);

  const eligibility = checkSendEligibility(
    contactRow ? { email: contactRow.email, emailStatus: contactRow.email_status } : null,
    (suppressions ?? []).map((s) => s.email)
  );
  if (!eligibility.allowed) {
    return { error: eligibility.reason };
  }

  const { data: settingsRow } = await supabase
    .from("user_settings")
    .select("sender_name, sender_email, email_provider")
    .eq("user_id", user?.id ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  if (!settingsRow?.sender_email) {
    return { error: "Set a sender email in Settings before sending." };
  }
  const fromAddress = settingsRow.sender_name ? `${settingsRow.sender_name} <${settingsRow.sender_email}>` : settingsRow.sender_email;

  await supabase.from("email_drafts").update({ status: "SENDING" }).eq("id", emailDraftId);
  await logEmailDraftEvent(supabase, emailDraftId, draft.status, "SENDING", user?.id ?? null);

  const provider = getEmailProvider({ provider: settingsRow.email_provider as "mock" | "resend" });

  let result;
  try {
    result = await provider.send({
      to: contactRow!.email!,
      from: fromAddress,
      subject: draft.subject,
      body: draft.body,
      campaignId: draft.campaign_id,
      contactId: draft.contact_id ?? "",
    });
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : "Failed to send email." };
  }

  if (!result.success) {
    await supabase.from("email_drafts").update({ status: "FAILED" }).eq("id", emailDraftId);
    await logEmailDraftEvent(supabase, emailDraftId, "SENDING", "FAILED", user?.id ?? null, result.error ?? "Send failed");
    revalidatePath(revalidatePathTarget);
    return { error: result.error ?? "Failed to send email." };
  }

  await supabase.from("email_drafts").update({ status: "SENT" }).eq("id", emailDraftId);
  await logEmailDraftEvent(supabase, emailDraftId, "SENDING", "SENT", user?.id ?? null, result.providerMessageId);

  revalidatePath(revalidatePathTarget);
  return {};
}
