import { z } from "zod";
import { qualificationWeightsSchema, DEFAULT_QUALIFICATION_WEIGHTS } from "./contracts/qualification";

/**
 * Per-user settings, per docs/spec.md §7: AI provider, model, research
 * limits, qualification weights, sender information, email provider.
 * Backed by supabase/migrations/20260911090000_settings_and_audit.sql.
 *
 * Not every field is consumed by the pipeline yet: AI provider/model,
 * qualification weights, and the two research limits are read by
 * trigger/research-workflow.ts and trigger/campaign-workflow.ts (see those
 * files). emailProvider/senderName/senderEmail are stored but NOT
 * consumed anywhere -- sending isn't wired into orchestration yet (spec
 * Phase 10 is interface-only, see workflows/03-phase-plan.md). Don't infer
 * from this type's existence that changing those two fields does anything.
 */
export const userSettingsSchema = z.object({
  aiProvider: z.enum(["openai", "anthropic"]),
  aiModel: z.string().nullable(),
  emailProvider: z.enum(["mock", "resend"]),
  maxPagesPerCompany: z.number().int().positive(),
  maxCompaniesPerCampaign: z.number().int().positive(),
  qualificationWeights: qualificationWeightsSchema,
  senderName: z.string().nullable(),
  senderEmail: z.string().nullable(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const DEFAULT_USER_SETTINGS: UserSettings = {
  aiProvider: "openai",
  aiModel: null,
  emailProvider: "mock",
  maxPagesPerCompany: 15,
  maxCompaniesPerCampaign: 200,
  qualificationWeights: DEFAULT_QUALIFICATION_WEIGHTS,
  senderName: null,
  senderEmail: null,
};
