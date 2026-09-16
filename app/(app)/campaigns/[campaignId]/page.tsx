import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { getCampaignWithStats, getUserSettings, getLatestSourcingRun } from "../../../../lib/database/queries";
import { PageHeader } from "../../../../components/layout/page-header";
import { Breadcrumbs } from "../../../../components/layout/breadcrumbs";
import { Card, CardBody, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { ProcessControls } from "../../../../components/campaigns/process-controls";
import { DeleteCampaignButton } from "../../../../components/campaigns/delete-campaign-button";
import { PipelineProgress } from "../../../../components/campaigns/pipeline-progress";
import { CsvImport } from "../../../../components/leads/csv-import";
import { SourceCompanies } from "../../../../components/leads/source-companies";
import type { CampaignStatus, CompanyResearchStatus } from "../../../../types/status";

export default async function CampaignDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
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
      <Breadcrumbs items={[{ label: "Campaigns", href: "/campaigns" }, { label: campaign.name }]} />
      <PageHeader
        title={campaign.name}
        description={campaign.description ?? undefined}
        actions={
          <>
            <ProcessControls campaignId={campaign.id} status={campaign.status as CampaignStatus} />
            {companies.length > 0 && (
              <Link href={`/campaigns/${campaign.id}/leads`}>
                <Button variant="secondary">View leads ({companies.length})</Button>
              </Link>
            )}
            {companies.length > 0 && (
              <a href={`/api/campaigns/${campaign.id}/export`}>
                <Button variant="secondary">Export approved</Button>
              </a>
            )}
            <DeleteCampaignButton campaignId={campaign.id} campaignName={campaign.name} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline progress</CardTitle>
            </CardHeader>
            <CardBody>
              <PipelineProgress statuses={companies.map((c) => c.research_status as CompanyResearchStatus)} />
            </CardBody>
          </Card>

          {companies.length === 0 && (
            <div className="grid gap-6 sm:grid-cols-2">
              <CsvImport campaignId={campaign.id} />
              <SourceCompanies
                campaignId={campaign.id}
                campaign={campaign}
                remainingCapacity={remainingCapacity}
                initialRun={
                  latestRun
                    ? { id: latestRun.id, status: latestRun.status as "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" }
                    : null
                }
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>ICP</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <DetailRow label="Status">
                <Badge tone="accent">{campaign.status}</Badge>
              </DetailRow>
              <DetailRow label="Industry" value={campaign.industry} />
              <DetailRow label="Geography" value={campaign.geography} />
              <DetailRow label="Company size" value={campaign.company_size} />
              <DetailRow label="Target roles" value={campaign.target_roles?.join(", ")} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offer</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <DetailRow label="Offer" value={campaign.offer_description} />
              <DetailRow label="Value proposition" value={campaign.value_proposition} />
              <DetailRow label="CTA" value={campaign.cta} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string | null; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-ink-muted">{label}</span>
      {children ?? <span className="text-right text-ink">{value || "—"}</span>}
    </div>
  );
}
