import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";
import type {
  CampaignPipelineRepository,
  CampaignRow,
  CompanyRow,
  NewResearchSource,
  NewResearchFinding,
  NewContact,
  NewQualification,
  NewEmailDraft,
  NewAgentRun,
} from "./repository";
import type { CompanyResearchStatus, FactType } from "../../types/status";

const TERMINAL_STATUSES: CompanyResearchStatus[] = ["EMAIL_READY", "NEEDS_REVIEW", "APPROVED", "FAILED"];

/** Real Supabase-backed implementation of CampaignPipelineRepository, used by trigger/ tasks at runtime. */
export class SupabaseCampaignRepository implements CampaignPipelineRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async getCampaign(campaignId: string): Promise<CampaignRow> {
    const { data, error } = await this.db.from("campaigns").select("*").eq("id", campaignId).single();
    if (error || !data) throw new Error(`Campaign ${campaignId} not found: ${error?.message}`);
    return data;
  }

  async getCompany(companyId: string): Promise<CompanyRow> {
    const { data, error } = await this.db.from("companies").select("*").eq("id", companyId).single();
    if (error || !data) throw new Error(`Company ${companyId} not found: ${error?.message}`);
    return data;
  }

  async getCompaniesToProcess(campaignId: string, limit: number): Promise<CompanyRow[]> {
    const { data, error } = await this.db
      .from("companies")
      .select("*")
      .eq("campaign_id", campaignId)
      .not("research_status", "in", `(${TERMINAL_STATUSES.join(",")})`)
      .limit(limit);
    if (error) throw new Error(`Failed to load companies for campaign ${campaignId}: ${error.message}`);
    return data ?? [];
  }

  async isCampaignPaused(campaignId: string): Promise<boolean> {
    const { data, error } = await this.db.from("campaigns").select("status").eq("id", campaignId).single();
    if (error || !data) throw new Error(`Campaign ${campaignId} not found: ${error?.message}`);
    return data.status === "PAUSED";
  }

  async updateCompanyStatus(companyId: string, status: CompanyResearchStatus): Promise<void> {
    const { error } = await this.db
      .from("companies")
      .update({ research_status: status, updated_at: new Date().toISOString() })
      .eq("id", companyId);
    if (error) throw new Error(`Failed to update status for company ${companyId}: ${error.message}`);
  }

  async updateCompanyQualification(
    companyId: string,
    score: number,
    tier: "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED"
  ): Promise<void> {
    const { error } = await this.db
      .from("companies")
      .update({ qualification_score: score, qualification_tier: tier, updated_at: new Date().toISOString() })
      .eq("id", companyId);
    if (error) throw new Error(`Failed to update qualification for company ${companyId}: ${error.message}`);
  }

  async replaceResearch(companyId: string, sources: NewResearchSource[], findings: NewResearchFinding[]) {
    // Delete-then-insert rather than append: a retried attempt must not
    // duplicate rows (see workflows/00-architecture.md's idempotent-writes note).
    const { error: deleteFindingsError } = await this.db
      .from("research_findings")
      .delete()
      .eq("company_id", companyId);
    if (deleteFindingsError) throw new Error(`Failed to clear prior findings: ${deleteFindingsError.message}`);

    const { error: deleteSourcesError } = await this.db.from("research_sources").delete().eq("company_id", companyId);
    if (deleteSourcesError) throw new Error(`Failed to clear prior sources: ${deleteSourcesError.message}`);

    const { data: insertedSources, error: sourcesError } = await this.db
      .from("research_sources")
      .insert(
        sources.map((s) => ({
          company_id: companyId,
          url: s.url,
          title: s.title,
          source_type: s.sourceType,
          content_hash: s.contentHash,
        }))
      )
      .select("id, url");
    if (sourcesError) throw new Error(`Failed to insert research sources: ${sourcesError.message}`);

    const sourceIdByUrl = new Map((insertedSources ?? []).map((s) => [s.url, s.id]));

    const { data: insertedFindings, error: findingsError } = await this.db
      .from("research_findings")
      .insert(
        findings.map((f) => ({
          company_id: companyId,
          source_id: sourceIdByUrl.get(f.sourceUrl) ?? null,
          category: f.category,
          claim: f.claim,
          evidence: f.evidence,
          confidence: f.confidence,
          fact_type: f.factType,
        }))
      )
      .select("id, category, claim, evidence, confidence, fact_type");
    if (findingsError) throw new Error(`Failed to insert research findings: ${findingsError.message}`);

    return (insertedFindings ?? []).map((f) => ({
      id: f.id,
      url: findings.find((orig) => orig.claim === f.claim)?.sourceUrl ?? "",
      category: f.category,
      claim: f.claim,
      evidence: f.evidence,
      confidence: f.confidence,
      // The generated Database type widens check-constrained text columns to
      // `string` (Supabase doesn't model CHECK constraints in its type gen);
      // the literal union is enforced at the Zod layer (types/contracts),
      // not by the DB client's types. Safe to narrow here.
      factType: f.fact_type as FactType,
    }));
  }

  async replaceContacts(companyId: string, contacts: NewContact[]) {
    const { error: deleteError } = await this.db.from("contacts").delete().eq("company_id", companyId);
    if (deleteError) throw new Error(`Failed to clear prior contacts: ${deleteError.message}`);

    const { data, error } = await this.db
      .from("contacts")
      .insert(
        contacts.map((c) => ({
          company_id: companyId,
          first_name: c.firstName,
          last_name: c.lastName,
          full_name: c.fullName,
          title: c.title,
          email: c.email,
          email_status: c.emailStatus,
          source_url: c.sourceUrl,
          confidence: c.confidence,
        }))
      )
      .select("id");
    if (error) throw new Error(`Failed to insert contacts: ${error.message}`);
    return data ?? [];
  }

  async insertQualification(companyId: string, qualification: NewQualification): Promise<void> {
    const { error } = await this.db.from("qualifications").insert({
      company_id: companyId,
      score: qualification.score,
      tier: qualification.tier,
      industry_score: qualification.industryScore,
      size_score: qualification.sizeScore,
      geography_score: qualification.geographyScore,
      problem_score: qualification.problemScore,
      decision_maker_score: qualification.decisionMakerScore,
      buying_signal_score: qualification.buyingSignalScore,
      reasons: qualification.reasons as never,
      risk_flags: qualification.riskFlags as never,
    });
    if (error) throw new Error(`Failed to insert qualification for company ${companyId}: ${error.message}`);
  }

  async insertEmailDraft(draft: NewEmailDraft): Promise<void> {
    const { error } = await this.db.from("email_drafts").insert({
      campaign_id: draft.campaignId,
      company_id: draft.companyId,
      contact_id: draft.contactId,
      subject: draft.subject,
      body: draft.body,
      personalization_hook: draft.personalizationHook,
      evidence_ids: draft.evidenceIds,
      confidence: draft.confidence,
      status: draft.status,
    });
    if (error) throw new Error(`Failed to insert email draft: ${error.message}`);
  }

  async insertAgentRun(run: NewAgentRun): Promise<void> {
    const { error } = await this.db.from("agent_runs").insert({
      campaign_id: run.campaignId,
      company_id: run.companyId,
      agent_type: run.agentType,
      status: run.status,
      input: run.input as never,
      output: run.output as never,
      error: run.error,
      started_at: run.startedAt,
      completed_at: run.completedAt,
    });
    if (error) throw new Error(`Failed to insert agent run: ${error.message}`);
  }
}
