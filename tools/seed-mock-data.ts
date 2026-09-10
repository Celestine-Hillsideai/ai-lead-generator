/**
 * Seeds a test campaign + companies into Supabase for exercising the full
 * pipeline (research -> decision makers -> qualification -> personalization
 * -> email) in MOCK_AI/MOCK_SEARCH/MOCK_EMAIL mode, without needing the
 * (not-yet-built) frontend to create a campaign through the UI.
 *
 * One seeded company has a deliberately unresolvable domain, so a run over
 * this campaign also exercises per-company failure isolation (spec §21) --
 * that company should end FAILED while the others complete normally.
 *
 * Usage: npx tsx tools/seed-mock-data.ts [user-email]
 *   (defaults to test@example.com; creates the auth user if it doesn't exist yet)
 *
 * Prints the created campaignId, ready to hand to:
 *   npm run trigger:campaign -- <campaignId>
 */

import { getSupabaseServiceClient } from "../lib/database/client";

// Real, stable, public websites -- NOT invented "*.example.com" subdomains.
// example.com itself resolves, but arbitrary subdomains of it do not, which
// means the crawler finds zero pages and the whole pipeline run never gets
// past the research stage. MOCK_AI/MOCK_SEARCH/MOCK_EMAIL mock the AI/search/
// email calls (per spec §29), but crawling was never one of the mockable
// pieces -- it needs a real, reachable website to prove anything.
const MOCK_COMPANIES = [
  {
    name: "IANA",
    website: "https://www.iana.org",
    normalized_domain: "www.iana.org",
    industry: "Internet Infrastructure",
    location: "Los Angeles, USA",
  },
  {
    name: "Mozilla",
    website: "https://www.mozilla.org",
    normalized_domain: "www.mozilla.org",
    industry: "Software",
    location: "Mountain View, USA",
  },
  {
    name: "Wikimedia Foundation",
    website: "https://www.wikimedia.org",
    normalized_domain: "www.wikimedia.org",
    industry: "Nonprofit",
    location: "San Francisco, USA",
  },
  {
    // Deliberately broken: DNS will fail to resolve this domain, so this
    // company's research-workflow run fails while the other three succeed --
    // exercises the per-company failure isolation in trigger/campaign-workflow.ts.
    name: "Broken Test Co",
    website: "https://this-domain-does-not-exist.ai-lead-generator-test.invalid",
    normalized_domain: "this-domain-does-not-exist.ai-lead-generator-test.invalid",
    industry: "Unknown",
    location: "Unknown",
  },
];

async function getOrCreateTestUser(email: string): Promise<string> {
  const db = getSupabaseServiceClient();

  const { data: existingUsers, error: listError } = await db.auth.admin.listUsers();
  if (listError) throw new Error(`Failed to list auth users: ${listError.message}`);

  const existing = existingUsers.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data: created, error: createError } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error(`Failed to create test user: ${createError?.message}`);
  return created.user.id;
}

async function main() {
  const email = process.argv[2] ?? "test@example.com";
  const db = getSupabaseServiceClient();

  console.log(`Ensuring test user ${email} exists...`);
  const userId = await getOrCreateTestUser(email);

  console.log("Creating test campaign...");
  const { data: campaign, error: campaignError } = await db
    .from("campaigns")
    .insert({
      user_id: userId,
      name: "Seed Test Campaign",
      industry: "Logistics",
      geography: "West Africa",
      company_size: "50-200",
      target_roles: ["CEO", "COO"],
      offer_description: "Real-time freight visibility platform",
      value_proposition: "Cut manual tracking overhead during expansion",
      cta: "Book a 15-minute call",
      status: "PROCESSING",
    })
    .select("id")
    .single();
  if (campaignError || !campaign) throw new Error(`Failed to create campaign: ${campaignError?.message}`);

  console.log(`Seeding ${MOCK_COMPANIES.length} companies...`);
  const { error: companiesError } = await db.from("companies").insert(
    MOCK_COMPANIES.map((c) => ({
      campaign_id: campaign.id,
      name: c.name,
      website: c.website,
      normalized_domain: c.normalized_domain,
      industry: c.industry,
      location: c.location,
      research_status: "IMPORTED" as const,
    }))
  );
  if (companiesError) throw new Error(`Failed to seed companies: ${companiesError.message}`);

  console.log(`\nDone. campaignId = ${campaign.id}`);
  console.log(`\nNext: npm run trigger:campaign -- ${campaign.id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
