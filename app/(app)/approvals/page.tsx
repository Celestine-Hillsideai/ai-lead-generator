import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getApprovalQueue, getEmailDraftHistory } from "../../../lib/database/queries";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardBody } from "../../../components/ui/card";
import { ApprovalQueue, type ApprovalQueueEntry } from "../../../components/leads/approval-queue";

export default async function ApprovalsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const queue = await getApprovalQueue(supabase, user.id);

  const companyIds = queue.map((d) => d.company_id);
  const { data: findings } = await supabase
    .from("research_findings")
    .select("*")
    .in("company_id", companyIds.length > 0 ? companyIds : ["00000000-0000-0000-0000-000000000000"]);
  const findingsByCompany = new Map<string, typeof findings>();
  for (const f of findings ?? []) {
    const list = findingsByCompany.get(f.company_id) ?? [];
    list.push(f);
    findingsByCompany.set(f.company_id, list);
  }

  const entries: ApprovalQueueEntry[] = await Promise.all(
    queue.map(async (draft) => ({
      draft,
      campaignName: draft.campaignName,
      companyName: draft.company?.name ?? "Unknown company",
      findings: (findingsByCompany.get(draft.company_id) ?? []).map((f) => ({
        id: f.id,
        claim: f.claim,
        evidence: f.evidence,
        sourceUrl: null,
        factType: f.fact_type,
        confidence: f.confidence,
      })),
      history: await getEmailDraftHistory(supabase, draft.id),
    }))
  );

  return (
    <div>
      <PageHeader
        title="Approvals"
        description={`${queue.length} email${queue.length === 1 ? "" : "s"} awaiting review across all campaigns.`}
      />

      {entries.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-ink-muted">Nothing needs review right now.</CardBody>
        </Card>
      ) : (
        <ApprovalQueue entries={entries} />
      )}
    </div>
  );
}
