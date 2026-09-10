import type {
  AgentRunStatus,
  AgentType,
  CampaignStatus,
  CompanyResearchStatus,
  ContactEmailStatus,
  EmailDraftStatus,
  FactType,
  QualificationTier,
} from "./status";

/**
 * Domain entity types (camelCase) per docs/spec.md §8. These mirror
 * lib/database/types.generated.ts's snake_case Rows -- agents/, prompts/,
 * and trigger/ code should work with these, not raw DB rows; the mapping
 * between the two happens at the lib/database boundary.
 */

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  industry: string | null;
  geography: string | null;
  companySize: string | null;
  targetRoles: string[];
  offerDescription: string | null;
  valueProposition: string | null;
  cta: string | null;
  researchInstructions: string | null;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Company {
  id: string;
  campaignId: string;
  name: string;
  website: string;
  normalizedDomain: string;
  industry: string | null;
  description: string | null;
  location: string | null;
  employeeSize: string | null;
  researchStatus: CompanyResearchStatus;
  qualificationScore: number | null;
  qualificationTier: QualificationTier | null;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  companyId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  title: string | null;
  email: string | null;
  emailStatus: ContactEmailStatus | null;
  sourceUrl: string | null;
  confidence: number | null;
  createdAt: string;
}

export interface ResearchSource {
  id: string;
  companyId: string;
  url: string;
  title: string | null;
  sourceType: string | null;
  retrievedAt: string;
  contentHash: string | null;
}

export interface ResearchFinding {
  id: string;
  companyId: string;
  sourceId: string | null;
  category: string | null;
  claim: string;
  evidence: string;
  confidence: number | null;
  factType: FactType;
  createdAt: string;
}

export interface Qualification {
  id: string;
  companyId: string;
  score: number;
  tier: QualificationTier;
  industryScore: number | null;
  sizeScore: number | null;
  geographyScore: number | null;
  problemScore: number | null;
  decisionMakerScore: number | null;
  buyingSignalScore: number | null;
  reasons: unknown;
  riskFlags: unknown;
  createdAt: string;
}

export interface EmailDraft {
  id: string;
  campaignId: string;
  companyId: string;
  contactId: string | null;
  subject: string;
  body: string;
  personalizationHook: string | null;
  evidenceIds: string[];
  confidence: number | null;
  status: EmailDraftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  campaignId: string;
  companyId: string | null;
  agentType: AgentType;
  status: AgentRunStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  retryCount: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface Suppression {
  id: string;
  userId: string | null;
  campaignId: string | null;
  email: string;
  reason: string | null;
  createdAt: string;
}
