import Link from "next/link";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getDashboardMetrics, getCampaignsForUser } from "../../../lib/database/queries";
import { PageHeader } from "../../../components/layout/page-header";
import { MetricCard } from "../../../components/dashboard/metric-card";
import { Button } from "../../../components/ui/button";
import { Card, CardBody } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { formatRelativeTime } from "../../../lib/utils/format";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [metrics, campaigns] = await Promise.all([
    getDashboardMetrics(supabase, user.id),
    getCampaignsForUser(supabase, user.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your campaigns and pipeline."
        actions={
          <Link href="/campaigns/new">
            <Button>New campaign</Button>
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard label="Campaigns" value={metrics.totalCampaigns} />
        <MetricCard label="Companies" value={metrics.totalCompanies} />
        <MetricCard label="Research completed" value={metrics.researchCompleted} />
        <MetricCard label="Decision makers found" value={metrics.decisionMakersFound} />
        <MetricCard label="High-quality leads" value={metrics.highQualityLeads} />
        <MetricCard label="Emails generated" value={metrics.emailsGenerated} />
        <MetricCard label="Needing review" value={metrics.emailsNeedingReview} />
        <MetricCard label="Emails approved" value={metrics.emailsApproved} />
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Recent campaigns</h2>
      {campaigns.length === 0 ? (
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-ink-muted">No campaigns yet.</p>
            <Link href="/campaigns/new" className="mt-3 inline-block">
              <Button>Create your first campaign</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.slice(0, 5).map((c) => (
            <Link key={c.id} href={`/campaigns/${c.id}`}>
              <Card className="transition-colors hover:border-accent-400">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ink">{c.name}</p>
                    <p className="text-sm text-ink-muted">Updated {formatRelativeTime(c.updated_at)}</p>
                  </div>
                  <Badge tone={c.status === "PROCESSING" ? "accent" : "neutral"}>{c.status}</Badge>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
