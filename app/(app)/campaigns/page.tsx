import Link from "next/link";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getCampaignsForUser } from "../../../lib/database/queries";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";
import { Card, CardBody } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { DeleteCampaignButton } from "../../../components/campaigns/delete-campaign-button";
import { formatRelativeTime } from "../../../lib/utils/format";
import type { CampaignStatus } from "../../../types/status";

const STATUS_TONE: Record<CampaignStatus, "neutral" | "accent" | "success" | "warning"> = {
  DRAFT: "neutral",
  READY: "neutral",
  PROCESSING: "accent",
  PAUSED: "warning",
  COMPLETED: "success",
  FAILED: "warning",
};

export default async function CampaignsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const campaigns = await getCampaignsForUser(supabase, user.id);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        actions={
          <Link href="/campaigns/new">
            <Button>New campaign</Button>
          </Link>
        }
      />

      {campaigns.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-ink-muted">No campaigns yet.</CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card key={c.id} className="transition-colors hover:border-accent-400">
              <CardBody className="flex items-center justify-between gap-4">
                <Link href={`/campaigns/${c.id}`} className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{c.name}</p>
                  <p className="text-sm text-ink-muted">
                    {c.industry ?? "No industry set"} · Updated {formatRelativeTime(c.updated_at)}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge tone={STATUS_TONE[c.status as CampaignStatus]}>{c.status}</Badge>
                  <DeleteCampaignButton campaignId={c.id} campaignName={c.name} size="sm" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
