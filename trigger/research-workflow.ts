import { task } from "@trigger.dev/sdk";
import { getSupabaseServiceClient } from "../lib/database/client";
import { SupabaseCampaignRepository } from "../lib/database/supabase-repository";
import type { CampaignPipelineRepository, NewAgentRun } from "../lib/database/repository";
import { getAIProvider } from "../lib/ai";
import type { AIProvider } from "../lib/ai/types";
import { getSearchProvider } from "../lib/search";
import type { SearchProvider } from "../lib/search/types";
import { crawlWebsite, type CrawlWebsiteFn } from "../lib/scraper/crawler";
import { runResearchAgent } from "../agents/research-agent";
import { runDecisionMakerAgent } from "../agents/decision-maker-agent";
import { runQualificationAgent } from "../agents/qualification-agent";
import { runPersonalizationAgent } from "../agents/personalization-agent";
import { runEmailAgent, needsReview } from "../agents/email-agent";
import type { AgentType } from "../types/status";

/**
 * Per-company pipeline, per docs/spec.md §21: research -> decision-maker
 * discovery -> qualification -> personalization -> email generation,
 * writing a status transition to Supabase after every stage. Exported as a
 * plain function (not the Trigger.dev task itself) so it's unit-testable
 * against fake dependencies -- see tests/unit/research-workflow.test.ts and
 * tests/helpers/fake-repository.ts.
 */

export interface ProcessCompanyDeps {
  repository: CampaignPipelineRepository;
  aiProvider: AIProvider;
  searchProvider: SearchProvider;
  crawlWebsite: CrawlWebsiteFn;
  maxPagesPerCompany?: number;
}

export interface ProcessCompanyPayload {
  campaignId: string;
  companyId: string;
}

async function withAgentRun<T>(
  repo: CampaignPipelineRepository,
  meta: { campaignId: string; companyId: string; agentType: AgentType; input: unknown },
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = new Date().toISOString();
  try {
    const output = await fn();
    const run: NewAgentRun = {
      campaignId: meta.campaignId,
      companyId: meta.companyId,
      agentType: meta.agentType,
      status: "SUCCEEDED",
      input: meta.input,
      output: output as unknown,
      error: null,
      startedAt,
      completedAt: new Date().toISOString(),
    };
    await repo.insertAgentRun(run);
    return output;
  } catch (err) {
    const run: NewAgentRun = {
      campaignId: meta.campaignId,
      companyId: meta.companyId,
      agentType: meta.agentType,
      status: "FAILED",
      input: meta.input,
      output: null,
      error: err instanceof Error ? err.message : String(err),
      startedAt,
      completedAt: new Date().toISOString(),
    };
    await repo.insertAgentRun(run);
    throw err;
  }
}

export async function processCompanyResearch(deps: ProcessCompanyDeps, payload: ProcessCompanyPayload): Promise<void> {
  const { repository: repo } = deps;
  const maxPages = deps.maxPagesPerCompany ?? Number(process.env.MAX_PAGES_PER_COMPANY ?? 15);

  const company = await repo.getCompany(payload.companyId);
  const campaign = await repo.getCampaign(payload.campaignId);

  try {
    await repo.updateCompanyStatus(company.id, "RESEARCHING");
    const crawl = await deps.crawlWebsite(company.website, { maxPages });

    const research = await withAgentRun(
      repo,
      { campaignId: campaign.id, companyId: company.id, agentType: "research", input: { website: company.website } },
      () => runResearchAgent(deps.aiProvider, { companyName: company.name, website: company.website, pages: crawl.pages })
    );

    const sourceUrls = new Set(research.findings.map((f) => f.sourceUrl));
    const insertedFindings = await repo.replaceResearch(
      company.id,
      Array.from(sourceUrls).map((url) => ({
        url,
        title: crawl.pages.find((p) => p.url === url)?.title ?? null,
        sourceType: "company_website",
        contentHash: null,
      })),
      research.findings.map((f) => ({
        sourceUrl: f.sourceUrl,
        category: f.category,
        claim: f.claim,
        evidence: f.evidence,
        confidence: f.confidence,
        factType: f.factType,
      }))
    );
    await repo.updateCompanyStatus(company.id, "RESEARCHED");

    await repo.updateCompanyStatus(company.id, "CONTACT_SEARCHING");
    const decisionMakers = await withAgentRun(
      repo,
      { campaignId: campaign.id, companyId: company.id, agentType: "decision_maker", input: { targetRoles: campaign.target_roles } },
      () =>
        runDecisionMakerAgent(deps.aiProvider, deps.searchProvider, {
          companyName: company.name,
          companyDomain: company.normalized_domain,
          targetRoles: campaign.target_roles,
          pages: crawl.pages,
        })
    );
    await repo.replaceContacts(
      company.id,
      decisionMakers.candidates.map((c) => ({
        firstName: c.firstName,
        lastName: c.lastName,
        fullName: c.fullName,
        title: c.title,
        email: c.email,
        emailStatus: c.emailStatus,
        sourceUrl: c.sourceUrl,
        confidence: c.confidence,
      }))
    );
    await repo.updateCompanyStatus(company.id, "CONTACT_FOUND");

    await repo.updateCompanyStatus(company.id, "QUALIFYING");
    const qualification = await withAgentRun(
      repo,
      { campaignId: campaign.id, companyId: company.id, agentType: "qualification", input: {} },
      () =>
        runQualificationAgent(deps.aiProvider, {
          campaign: {
            industry: campaign.industry,
            geography: campaign.geography,
            companySize: campaign.company_size,
            targetRoles: campaign.target_roles,
            offerDescription: campaign.offer_description,
          },
          research,
          decisionMakers,
        })
    );
    await repo.insertQualification(company.id, qualification);
    await repo.updateCompanyQualification(company.id, qualification.score, qualification.tier);
    await repo.updateCompanyStatus(company.id, "QUALIFIED");

    // No usable evidence -- can't personalize responsibly (agents/personalization-agent.ts
    // requires at least one finding). Land on NEEDS_REVIEW rather than fabricating content.
    if (insertedFindings.length === 0) {
      await repo.updateCompanyStatus(company.id, "NEEDS_REVIEW");
      return;
    }

    await repo.updateCompanyStatus(company.id, "EMAIL_GENERATING");
    const primaryCandidate = decisionMakers.candidates[0] ?? null;

    const personalization = await withAgentRun(
      repo,
      { campaignId: campaign.id, companyId: company.id, agentType: "personalization", input: {} },
      () =>
        runPersonalizationAgent(deps.aiProvider, {
          campaign: {
            offerDescription: campaign.offer_description,
            valueProposition: campaign.value_proposition,
            cta: campaign.cta,
          },
          findings: insertedFindings.map((f) => ({
            id: f.id,
            claim: f.claim,
            evidence: f.evidence,
            sourceUrl: f.url,
            category: f.category ?? "general",
            factType: f.factType,
            confidence: f.confidence ?? 0.5,
          })),
          decisionMakerName: primaryCandidate?.fullName ?? null,
          decisionMakerTitle: primaryCandidate?.title ?? null,
        })
    );

    const email = await withAgentRun(
      repo,
      { campaignId: campaign.id, companyId: company.id, agentType: "email", input: {} },
      () =>
        runEmailAgent(deps.aiProvider, {
          campaign: {
            offerDescription: campaign.offer_description,
            valueProposition: campaign.value_proposition,
            cta: campaign.cta,
            researchInstructions: campaign.research_instructions,
          },
          personalization,
          recipientFirstName: primaryCandidate?.firstName ?? null,
        })
    );

    await repo.insertEmailDraft({
      campaignId: campaign.id,
      companyId: company.id,
      contactId: null, // resolved from the replaceContacts insert in a future pass once contact<->candidate matching is needed by the frontend
      subject: email.subject,
      body: email.body,
      personalizationHook: email.personalizationHook,
      evidenceIds: email.evidenceIds,
      confidence: email.confidence,
      status: "READY",
    });

    await repo.updateCompanyStatus(company.id, needsReview(email.confidence) ? "NEEDS_REVIEW" : "EMAIL_READY");
  } catch (err) {
    await repo.updateCompanyStatus(company.id, "FAILED");
    throw err; // rethrow so Trigger.dev's own attempt/retry tracking still applies
  }
}

export const researchWorkflow = task({
  id: "research-workflow",
  retry: { maxAttempts: 4 }, // network-bound (crawling) -- transient failures are common and cheap to retry
  queue: { concurrencyLimit: Number(process.env.MAX_CONCURRENT_REQUESTS ?? 5) },
  run: async (payload: ProcessCompanyPayload) => {
    const db = getSupabaseServiceClient();
    await processCompanyResearch(
      {
        repository: new SupabaseCampaignRepository(db),
        aiProvider: getAIProvider(),
        searchProvider: getSearchProvider(),
        crawlWebsite,
      },
      payload
    );
  },
});
