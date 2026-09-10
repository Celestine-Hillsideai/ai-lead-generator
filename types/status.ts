import { z } from "zod";

/**
 * Status literal unions matching the `check` constraints in
 * supabase/migrations/20260910120001_core_tables.sql, derived from
 * docs/spec.md §26. Keep these two in sync by hand -- there is no
 * single source of truth shared between SQL and TypeScript.
 */

export const campaignStatusSchema = z.enum([
  "DRAFT",
  "READY",
  "PROCESSING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
]);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

export const companyResearchStatusSchema = z.enum([
  "IMPORTED",
  "RESEARCHING",
  "RESEARCHED",
  "CONTACT_SEARCHING",
  "CONTACT_FOUND",
  "QUALIFYING",
  "QUALIFIED",
  "EMAIL_GENERATING",
  "EMAIL_READY",
  "NEEDS_REVIEW",
  "APPROVED",
  "FAILED",
]);
export type CompanyResearchStatus = z.infer<typeof companyResearchStatusSchema>;

export const qualificationTierSchema = z.enum(["HIGH", "MEDIUM", "LOW", "UNQUALIFIED"]);
export type QualificationTier = z.infer<typeof qualificationTierSchema>;

export const contactEmailStatusSchema = z.enum([
  "verified",
  "public",
  "unverified",
  "invalid",
  "unknown",
]);
export type ContactEmailStatus = z.infer<typeof contactEmailStatusSchema>;

export const emailDraftStatusSchema = z.enum([
  "DRAFT",
  "READY",
  "APPROVED",
  "REJECTED",
  "SENDING",
  "SENT",
  "FAILED",
]);
export type EmailDraftStatus = z.infer<typeof emailDraftStatusSchema>;

export const agentTypeSchema = z.enum([
  "research",
  "decision_maker",
  "qualification",
  "personalization",
  "email",
]);
export type AgentType = z.infer<typeof agentTypeSchema>;

export const agentRunStatusSchema = z.enum(["PENDING", "RUNNING", "SUCCEEDED", "FAILED"]);
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>;

export const factTypeSchema = z.enum(["FACT", "INFERENCE", "UNKNOWN"]);
export type FactType = z.infer<typeof factTypeSchema>;
