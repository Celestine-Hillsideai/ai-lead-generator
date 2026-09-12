import { z } from "zod";
import { qualificationWeightsSchema, DEFAULT_QUALIFICATION_WEIGHTS } from "./contracts/qualification";

/**
 * Per-user settings, per docs/spec.md §7: AI provider, model, research
 * limits, qualification weights, sender information, email provider.
 * Backed by supabase/migrations/20260911090000_settings_and_audit.sql.
 *
 * aiProvider/aiModel, qualificationWeights, and the two research limits are
 * read by trigger/research-workflow.ts and trigger/campaign-workflow.ts.
 * maxCompaniesPerSourcingRun is read by trigger/sourcing-workflow.ts (spec
 * §11A). emailProvider/senderName/senderEmail are read by
 * app/actions/emails.ts's sendEmailAction: senderEmail (required) and
 * senderName build the From address, and emailProvider is passed to
 * lib/email's getEmailProvider() as an override (MOCK_EMAIL still wins as
 * the global kill switch regardless of this setting).
 */
export const userSettingsSchema = z.object({
  aiProvider: z.enum(["openai", "anthropic"]),
  aiModel: z.string().nullable(),
  emailProvider: z.enum(["mock", "resend"]),
  maxPagesPerCompany: z.number().int().positive(),
  maxCompaniesPerCampaign: z.number().int().positive(),
  maxCompaniesPerSourcingRun: z.number().int().positive(),
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
  maxCompaniesPerSourcingRun: 50,
  qualificationWeights: DEFAULT_QUALIFICATION_WEIGHTS,
  senderName: null,
  senderEmail: null,
};
