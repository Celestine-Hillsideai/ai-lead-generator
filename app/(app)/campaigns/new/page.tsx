import { PageHeader } from "../../../../components/layout/page-header";
import { Breadcrumbs } from "../../../../components/layout/breadcrumbs";
import { CampaignForm } from "../../../../components/campaigns/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Breadcrumbs items={[{ label: "Campaigns", href: "/campaigns" }, { label: "New" }]} />
      <PageHeader title="New campaign" description="Define your ICP and offer. You'll import leads next." />
      <CampaignForm />
    </div>
  );
}
