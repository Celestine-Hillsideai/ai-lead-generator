import { PageHeader } from "../../../../components/layout/page-header";
import { CampaignForm } from "../../../../components/campaigns/campaign-form";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New campaign" description="Define your ICP and offer. You'll import leads next." />
      <CampaignForm />
    </div>
  );
}
