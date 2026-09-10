import type { Database } from "./types.generated";
import type {
  AgentType,
  CompanyResearchStatus,
  FactType,
  ContactEmailStatus,
  EmailDraftStatus,
} from "../../types/status";

/**
 * The subset of DB operations trigger/research-workflow.ts and
 * campaign-workflow.ts need, behind an interface so orchestration logic can
 * be unit-tested against an in-memory fake (tests/helpers/fake-repository.ts)
 * instead of a live Supabase project. SupabaseCampaignRepository below is
 * the real implementation used at runtime.
 */

export type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

export interface NewResearchSource {
  url: string;
  title: string | null;
  sourceType: string | null;
  contentHash: string | null;
}

export interface NewResearchFinding {
  sourceUrl: string; // resolved to a source_id by the repository implementation
  category: string | null;
  claim: string;
  evidence: string;
  confidence: number | null;
  factType: FactType;
}

export interface NewContact {
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  title: string;
  email: string | null;
  emailStatus: ContactEmailStatus;
  sourceUrl: string | null;
  confidence: number;
}

export interface NewQualification {
  score: number;
  tier: "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED";
  industryScore: number;
  sizeScore: number;
  geographyScore: number;
  problemScore: number;
  decisionMakerScore: number;
  buyingSignalScore: number;
  reasons: unknown;
  riskFlags: unknown;
}

export interface NewEmailDraft {
  campaignId: string;
  companyId: string;
  contactId: string | null;
  subject: string;
  body: string;
  personalizationHook: string | null;
  evidenceIds: string[];
  confidence: number;
  status: EmailDraftStatus;
}

export interface NewAgentRun {
  campaignId: string;
  companyId: string | null;
  agentType: AgentType;
  status: "SUCCEEDED" | "FAILED";
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: string;
  completedAt: string;
}

export interface CampaignPipelineRepository {
  getCampaign(campaignId: string): Promise<CampaignRow>;
  getCompany(companyId: string): Promise<CompanyRow>;
  /** Companies not yet in a terminal status -- makes campaign resume idempotent (see workflows/00-architecture.md). */
  getCompaniesToProcess(campaignId: string, limit: number): Promise<CompanyRow[]>;
  isCampaignPaused(campaignId: string): Promise<boolean>;

  updateCompanyStatus(companyId: string, status: CompanyResearchStatus): Promise<void>;
  updateCompanyQualification(
    companyId: string,
    score: number,
    tier: "HIGH" | "MEDIUM" | "LOW" | "UNQUALIFIED"
  ): Promise<void>;

  /** Replaces any existing sources/findings for this company (upsert-by-replace, not append) -- see workflows/00-architecture.md's idempotent-writes note. */
  replaceResearch(
    companyId: string,
    sources: NewResearchSource[],
    findings: NewResearchFinding[]
  ): Promise<{ id: string; url: string; category: string | null; claim: string; evidence: string; confidence: number | null; factType: FactType }[]>;

  replaceContacts(companyId: string, contacts: NewContact[]): Promise<{ id: string }[]>;
  insertQualification(companyId: string, qualification: NewQualification): Promise<void>;
  insertEmailDraft(draft: NewEmailDraft): Promise<void>;
  insertAgentRun(run: NewAgentRun): Promise<void>;
}
