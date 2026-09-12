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
  CompanySourcingRepository,
  SourcingRunRow,
  NewSourcedCompany,
  SourcingRunStatusPatch,
} from "../../lib/database/repository";
import type { CompanyResearchStatus } from "../../types/status";
import type { UserSettings } from "../../types/settings";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter++;
  return `${prefix}-${idCounter}`;
}

/**
 * In-memory CampaignPipelineRepository for unit-testing trigger/
 * orchestration logic without a live Supabase project. Mirrors the real
 * SupabaseCampaignRepository's behavior (delete-then-insert for
 * replaceResearch/replaceContacts, terminal-status filtering for
 * getCompaniesToProcess) closely enough to exercise the orchestration code
 * paths that matter.
 */
export class FakeCampaignRepository implements CampaignPipelineRepository, CompanySourcingRepository {
  campaigns = new Map<string, CampaignRow>();
  companies = new Map<string, CompanyRow>();
  agentRuns: NewAgentRun[] = [];
  emailDrafts: NewEmailDraft[] = [];
  qualifications: (NewQualification & { companyId: string })[] = [];
  contactsByCompany = new Map<string, NewContact[]>();
  findingsByCompany = new Map<string, (NewResearchFinding & { id: string })[]>();
  userSettings = new Map<string, UserSettings>();
  sourcingRuns = new Map<string, SourcingRunRow>();

  async getUserSettings(userId: string): Promise<UserSettings | null> {
    return this.userSettings.get(userId) ?? null;
  }

  seedCampaign(overrides: Partial<CampaignRow> & { id: string }): CampaignRow {
    const campaign: CampaignRow = {
      id: overrides.id,
      user_id: overrides.user_id ?? "user-1",
      name: overrides.name ?? "Test Campaign",
      description: overrides.description ?? null,
      industry: overrides.industry ?? null,
      geography: overrides.geography ?? null,
      company_size: overrides.company_size ?? null,
      target_roles: overrides.target_roles ?? ["CEO"],
      offer_description: overrides.offer_description ?? null,
      value_proposition: overrides.value_proposition ?? null,
      cta: overrides.cta ?? null,
      research_instructions: overrides.research_instructions ?? null,
      status: overrides.status ?? "PROCESSING",
      created_at: overrides.created_at ?? new Date().toISOString(),
      updated_at: overrides.updated_at ?? new Date().toISOString(),
    };
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  seedCompany(overrides: Partial<CompanyRow> & { id: string; campaign_id: string }): CompanyRow {
    const company: CompanyRow = {
      id: overrides.id,
      campaign_id: overrides.campaign_id,
      name: overrides.name ?? "Acme",
      website: overrides.website ?? "https://acme.example.com",
      normalized_domain: overrides.normalized_domain ?? "acme.example.com",
      industry: overrides.industry ?? null,
      description: overrides.description ?? null,
      location: overrides.location ?? null,
      employee_size: overrides.employee_size ?? null,
      research_status: overrides.research_status ?? "IMPORTED",
      qualification_score: overrides.qualification_score ?? null,
      qualification_tier: overrides.qualification_tier ?? null,
      source_type: overrides.source_type ?? "csv_import",
      source_provider: overrides.source_provider ?? null,
      sourcing_run_id: overrides.sourcing_run_id ?? null,
      created_at: overrides.created_at ?? new Date().toISOString(),
      updated_at: overrides.updated_at ?? new Date().toISOString(),
    };
    this.companies.set(company.id, company);
    return company;
  }

  seedSourcingRun(overrides: Partial<SourcingRunRow> & { id: string; campaign_id: string }): SourcingRunRow {
    const run: SourcingRunRow = {
      id: overrides.id,
      campaign_id: overrides.campaign_id,
      requested_by: overrides.requested_by ?? "user-1",
      provider: overrides.provider ?? "mock",
      target_count: overrides.target_count ?? 10,
      status: overrides.status ?? "PENDING",
      discovered_count: overrides.discovered_count ?? 0,
      inserted_count: overrides.inserted_count ?? 0,
      skipped_count: overrides.skipped_count ?? 0,
      error: overrides.error ?? null,
      created_at: overrides.created_at ?? new Date().toISOString(),
      completed_at: overrides.completed_at ?? null,
    };
    this.sourcingRuns.set(run.id, run);
    return run;
  }

  async getCampaign(campaignId: string): Promise<CampaignRow> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    return campaign;
  }

  async getCompany(companyId: string): Promise<CompanyRow> {
    const company = this.companies.get(companyId);
    if (!company) throw new Error(`Company ${companyId} not found`);
    return company;
  }

  async getCompaniesToProcess(campaignId: string, limit: number): Promise<CompanyRow[]> {
    const terminal: CompanyResearchStatus[] = ["EMAIL_READY", "NEEDS_REVIEW", "APPROVED", "FAILED"];
    return Array.from(this.companies.values())
      .filter((c) => c.campaign_id === campaignId && !terminal.includes(c.research_status as CompanyResearchStatus))
      .slice(0, limit);
  }

  async isCampaignPaused(campaignId: string): Promise<boolean> {
    return (await this.getCampaign(campaignId)).status === "PAUSED";
  }

  async updateCompanyStatus(companyId: string, status: CompanyResearchStatus): Promise<void> {
    const company = await this.getCompany(companyId);
    company.research_status = status;
    company.updated_at = new Date().toISOString();
  }

  async updateCompanyQualification(
    companyId: string,
    score: number,
    tier: "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED"
  ): Promise<void> {
    const company = await this.getCompany(companyId);
    company.qualification_score = score;
    company.qualification_tier = tier;
  }

  async replaceResearch(companyId: string, _sources: NewResearchSource[], findings: NewResearchFinding[]) {
    const withIds = findings.map((f) => ({ ...f, id: nextId("finding") }));
    this.findingsByCompany.set(companyId, withIds);
    return withIds.map((f) => ({
      id: f.id,
      url: f.sourceUrl,
      category: f.category,
      claim: f.claim,
      evidence: f.evidence,
      confidence: f.confidence,
      factType: f.factType,
    }));
  }

  async replaceContacts(companyId: string, contacts: NewContact[]) {
    this.contactsByCompany.set(companyId, contacts);
    return contacts.map(() => ({ id: nextId("contact") }));
  }

  async insertQualification(companyId: string, qualification: NewQualification): Promise<void> {
    this.qualifications.push({ ...qualification, companyId });
  }

  async insertEmailDraft(draft: NewEmailDraft): Promise<void> {
    this.emailDrafts.push(draft);
  }

  async insertAgentRun(run: NewAgentRun): Promise<void> {
    this.agentRuns.push(run);
  }

  async getSourcingRun(id: string): Promise<SourcingRunRow> {
    const run = this.sourcingRuns.get(id);
    if (!run) throw new Error(`Sourcing run ${id} not found`);
    return run;
  }

  async updateSourcingRunStatus(id: string, patch: SourcingRunStatusPatch): Promise<void> {
    const run = await this.getSourcingRun(id);
    run.status = patch.status;
    if (patch.provider !== undefined) run.provider = patch.provider;
    if (patch.discoveredCount !== undefined) run.discovered_count = patch.discoveredCount;
    if (patch.insertedCount !== undefined) run.inserted_count = patch.insertedCount;
    if (patch.skippedCount !== undefined) run.skipped_count = patch.skippedCount;
    if (patch.error !== undefined) run.error = patch.error;
    if (patch.completedAt !== undefined) run.completed_at = patch.completedAt;
  }

  async getCompanyDomainsForCampaign(campaignId: string): Promise<string[]> {
    return Array.from(this.companies.values())
      .filter((c) => c.campaign_id === campaignId)
      .map((c) => c.normalized_domain);
  }

  async countCompaniesForCampaign(campaignId: string): Promise<number> {
    return Array.from(this.companies.values()).filter((c) => c.campaign_id === campaignId).length;
  }

  async insertSourcedCompanies(companies: NewSourcedCompany[]): Promise<{ id: string }[]> {
    return companies.map((c) => {
      const id = nextId("sourced-company");
      this.seedCompany({
        id,
        campaign_id: c.campaignId,
        name: c.name,
        website: c.website,
        normalized_domain: c.normalizedDomain,
        industry: c.industry,
        location: c.location,
        research_status: "IMPORTED",
        source_type: "auto_sourced",
        source_provider: c.sourceProvider,
        sourcing_run_id: c.sourcingRunId,
      });
      return { id };
    });
  }
}
