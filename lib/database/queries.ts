import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";
import { DEFAULT_USER_SETTINGS, type UserSettings } from "../../types/settings";
import { DEFAULT_QUALIFICATION_WEIGHTS } from "../../types/contracts";

/**
 * Read queries the frontend uses (as the authenticated user, RLS-scoped),
 * separate from lib/database/repository.ts which is Trigger.dev's
 * service-role write path. Kept here rather than inline in Server
 * Components so the same query can be reused from multiple pages.
 */

export async function getDashboardMetrics(db: SupabaseClient<Database>, userId: string) {
  const { data: campaigns } = await db.from("campaigns").select("id, status").eq("user_id", userId);
  const campaignIds = (campaigns ?? []).map((c) => c.id);

  if (campaignIds.length === 0) {
    return {
      totalCampaigns: 0,
      totalCompanies: 0,
      researchCompleted: 0,
      decisionMakersFound: 0,
      highQualityLeads: 0,
      emailsGenerated: 0,
      emailsNeedingReview: 0,
      emailsApproved: 0,
      emailsSent: 0,
    };
  }

  const { data: companies } = await db
    .from("companies")
    .select("id, research_status, qualification_tier")
    .in("campaign_id", campaignIds);

  const { data: emailDrafts } = await db.from("email_drafts").select("status").in("campaign_id", campaignIds);

  const { count: contactCount } = await db
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .in(
      "company_id",
      (companies ?? []).map((c) => c.id)
    );

  const rows = companies ?? [];
  const drafts = emailDrafts ?? [];

  return {
    totalCampaigns: campaigns?.length ?? 0,
    totalCompanies: rows.length,
    researchCompleted: rows.filter((c) => c.research_status !== "IMPORTED" && c.research_status !== "RESEARCHING")
      .length,
    decisionMakersFound: contactCount ?? 0,
    highQualityLeads: rows.filter((c) => c.qualification_tier === "HIGH").length,
    emailsGenerated: drafts.length,
    emailsNeedingReview: rows.filter((c) => c.research_status === "NEEDS_REVIEW").length,
    emailsApproved: drafts.filter((d) => d.status === "APPROVED").length,
    emailsSent: drafts.filter((d) => d.status === "SENT").length,
  };
}

export async function getCampaignsForUser(db: SupabaseClient<Database>, userId: string) {
  const { data, error } = await db
    .from("campaigns")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to load campaigns: ${error.message}`);
  return data ?? [];
}

export async function getCampaignWithStats(db: SupabaseClient<Database>, campaignId: string) {
  const { data: campaign, error } = await db.from("campaigns").select("*").eq("id", campaignId).single();
  if (error || !campaign) throw new Error(`Campaign not found: ${error?.message}`);

  const { data: companies } = await db.from("companies").select("*").eq("campaign_id", campaignId);

  return { campaign, companies: companies ?? [] };
}

export async function getCompanyDetail(db: SupabaseClient<Database>, companyId: string) {
  const { data: company, error } = await db.from("companies").select("*").eq("id", companyId).single();
  if (error || !company) throw new Error(`Company not found: ${error?.message}`);

  const [{ data: findings }, { data: contacts }, { data: qualification }, { data: emailDrafts }] = await Promise.all([
    db.from("research_findings").select("*").eq("company_id", companyId).order("confidence", { ascending: false }),
    db.from("contacts").select("*").eq("company_id", companyId).order("confidence", { ascending: false }),
    db.from("qualifications").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("email_drafts").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
  ]);

  return {
    company,
    findings: findings ?? [],
    contacts: contacts ?? [],
    qualification: qualification ?? null,
    emailDrafts: emailDrafts ?? [],
  };
}

export async function getApprovalQueue(
  db: SupabaseClient<Database>,
  userId: string,
  status: "READY" | "APPROVED" = "READY"
) {
  const { data: campaigns } = await db.from("campaigns").select("id, name").eq("user_id", userId);
  const campaignIds = (campaigns ?? []).map((c) => c.id);
  if (campaignIds.length === 0) return [];

  const { data: drafts, error } = await db
    .from("email_drafts")
    .select("*")
    .in("campaign_id", campaignIds)
    .eq("status", status)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load approval queue: ${error.message}`);

  const companyIds = (drafts ?? []).map((d) => d.company_id);
  const { data: companies } = await db
    .from("companies")
    .select("id, name, website, qualification_tier")
    .in("id", companyIds.length > 0 ? companyIds : ["00000000-0000-0000-0000-000000000000"]);

  const contactIds = (drafts ?? []).map((d) => d.contact_id).filter((id): id is string => id !== null);
  const { data: contacts } = await db
    .from("contacts")
    .select("id, full_name, email, email_status")
    .in("id", contactIds.length > 0 ? contactIds : ["00000000-0000-0000-0000-000000000000"]);

  const campaignNameById = new Map(campaignIds.map((id, i) => [id, campaigns![i]!.name]));
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  return (drafts ?? []).map((d) => ({
    ...d,
    campaignName: campaignNameById.get(d.campaign_id) ?? "",
    company: companyById.get(d.company_id) ?? null,
    contact: d.contact_id ? (contactById.get(d.contact_id) ?? null) : null,
  }));
}

/** Returns DEFAULT_USER_SETTINGS (not null) when the user has never saved settings, so the form always has something to render. */
export async function getUserSettings(db: SupabaseClient<Database>, userId: string): Promise<UserSettings> {
  const { data, error } = await db.from("user_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`Failed to load settings: ${error.message}`);
  if (!data) return DEFAULT_USER_SETTINGS;

  return {
    aiProvider: data.ai_provider as "openai" | "anthropic",
    aiModel: data.ai_model,
    emailProvider: data.email_provider as "mock" | "resend",
    maxPagesPerCompany: data.max_pages_per_company,
    maxCompaniesPerCampaign: data.max_companies_per_campaign,
    qualificationWeights: {
      ...DEFAULT_QUALIFICATION_WEIGHTS,
      ...(data.qualification_weights as Record<string, number>),
    },
    senderName: data.sender_name,
    senderEmail: data.sender_email,
  };
}

export async function getEmailDraftHistory(db: SupabaseClient<Database>, emailDraftId: string) {
  const { data, error } = await db
    .from("email_draft_events")
    .select("*")
    .eq("email_draft_id", emailDraftId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load draft history: ${error.message}`);
  return data ?? [];
}
