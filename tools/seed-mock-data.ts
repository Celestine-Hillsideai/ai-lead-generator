/**
 * Seed mock companies/leads into Supabase for MOCK_AI/MOCK_SEARCH/MOCK_EMAIL
 * dev mode, so the full pipeline (research -> decision makers -> qualification
 * -> personalization -> email) can be exercised end-to-end without live APIs.
 *
 * TODO(Phase 1+): this needs lib/database's Supabase client and the schema
 * from supabase/migrations, neither of which exist yet. Wire this up once
 * those land -- see workflows/03-phase-plan.md.
 *
 * Intended usage once implemented: `npx tsx tools/seed-mock-data.ts`
 */

const MOCK_COMPANIES: Array<{
  company_name: string;
  website: string;
  industry?: string;
  location?: string;
  notes?: string;
}> = [
  { company_name: "Acme Logistics", website: "https://acme-logistics.example.com", industry: "Logistics", location: "Lagos, Nigeria" },
  { company_name: "Northwind Traders", website: "https://northwind.example.com", industry: "Retail", location: "Accra, Ghana" },
  { company_name: "Fabrikam Manufacturing", website: "https://fabrikam.example.com", industry: "Manufacturing", location: "Nairobi, Kenya" },
];

async function main() {
  throw new Error(
    "seed-mock-data.ts is a stub -- implement once lib/database (Supabase client) and the campaign/company schema exist. " +
      "See workflows/03-phase-plan.md (Phase 1) and docs/spec.md §8-9."
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

export { MOCK_COMPANIES };
