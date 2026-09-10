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
} from "../../lib/database/repository";
import type { CompanyResearchStatus } from "../../types/status";

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
export class FakeCampaignRepository implements CampaignPipelineRepository {
  campaigns = new Map<string, CampaignRow>();
  companies = new Map<string, CompanyRow>();
  agentRuns: NewAgentRun[] = [];
  emailDrafts: NewEmailDraft[] = [];
  qualifications: (NewQualification & { companyId: string })[] = [];
  contactsByCompany = new Map<string, NewContact[]>();
  findingsByCompany = new Map<string, (NewResearchFinding & { id: string })[]>();

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
      created_at: overrides.created_at ?? new Date().toISOString(),
      updated_at: overrides.updated_at ?? new Date().toISOString(),
    };
    this.companies.set(company.id, company);
    return company;
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
      .filter((c) => c.campaign_id === campaignId && !terminal.includes(c.research_status))
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
}
