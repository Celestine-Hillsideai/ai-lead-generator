import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { getCampaignWithStats, getUserSettings, getLatestSourcingRun } from "../../../../../lib/database/queries";
import { PageHeader } from "../../../../../components/layout/page-header";
import { Breadcrumbs } from "../../../../../components/layout/breadcrumbs";
import { LeadsTable } from "../../../../../components/leads/leads-table";
import { CsvImport } from "../../../../../components/leads/csv-import";
import { SourceCompanies } from "../../../../../components/leads/source-companies";

export default async function LeadsPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  let campaign, companies;
  try {
    ({ campaign, companies } = await getCampaignWithStats(supabase, campaignId));
  } catch {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const settings = user ? await getUserSettings(supabase, user.id) : null;
  const remainingCapacity = Math.max(0, (settings?.maxCompaniesPerCampaign ?? 200) - companies.length);
  const latestRun = await getLatestSourcingRun(supabase, campaignId);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Campaigns", href: "/campaigns" },
          { label: campaign.name, href: `/campaigns/${campaignId}` },
          { label: "Leads" },
        ]}
      />
      <PageHeader title={`${campaign.name} — Leads`} description={`${companies.length} companies imported`} />
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <CsvImport campaignId={campaignId} />
        <SourceCompanies
          campaignId={campaignId}
          campaign={campaign}
          remainingCapacity={remainingCapacity}
          initialRun={latestRun ? { id: latestRun.id, status: latestRun.status as "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" } : null}
        />
      </div>
      <LeadsTable campaignId={campaignId} companies={companies} />
    </div>
  );
}
