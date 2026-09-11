import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { getCampaignWithStats } from "../../../../../lib/database/queries";
import { PageHeader } from "../../../../../components/layout/page-header";
import { LeadsTable } from "../../../../../components/leads/leads-table";
import { CsvImport } from "../../../../../components/leads/csv-import";

export default async function LeadsPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  let campaign, companies;
  try {
    ({ campaign, companies } = await getCampaignWithStats(supabase, campaignId));
  } catch {
    notFound();
  }

  return (
    <div>
      <PageHeader title={`${campaign.name} — Leads`} description={`${companies.length} companies imported`} />
      <div className="mb-6">
        <CsvImport campaignId={campaignId} />
      </div>
      <LeadsTable campaignId={campaignId} companies={companies} />
    </div>
  );
}
