import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getApprovalQueue, getEmailDraftHistory } from "../../../lib/database/queries";
import { PageHeader } from "../../../components/layout/page-header";
import { Breadcrumbs } from "../../../components/layout/breadcrumbs";
import { Card, CardBody } from "../../../components/ui/card";
import { ApprovalQueue, type ApprovalQueueEntry } from "../../../components/leads/approval-queue";

export default async function ApprovalsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [reviewQueue, sendQueue] = await Promise.all([
    getApprovalQueue(supabase, user.id, "READY"),
    getApprovalQueue(supabase, user.id, "APPROVED"),
  ]);

  const allDrafts = [...reviewQueue, ...sendQueue];
  const companyIds = allDrafts.map((d) => d.company_id);
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

  async function toEntries(queue: typeof allDrafts): Promise<ApprovalQueueEntry[]> {
    return Promise.all(
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
        recipient: draft.contact
          ? { fullName: draft.contact.full_name, email: draft.contact.email, emailStatus: draft.contact.email_status }
          : null,
      }))
    );
  }

  const reviewEntries = await toEntries(reviewQueue);
  const sendEntries = await toEntries(sendQueue);

  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs items={[{ label: "Approvals" }]} />
        <PageHeader
          title="Approvals"
          description={`${reviewEntries.length} email${reviewEntries.length === 1 ? "" : "s"} awaiting review across all campaigns.`}
        />

        {reviewEntries.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center text-ink-muted">Nothing needs review right now.</CardBody>
          </Card>
        ) : (
          <ApprovalQueue entries={reviewEntries} />
        )}
      </div>

      <div>
        <PageHeader
          title="Ready to send"
          description={`${sendEntries.length} approved email${sendEntries.length === 1 ? "" : "s"} not yet sent.`}
        />

        {sendEntries.length === 0 ? (
          <Card>
            <CardBody className="py-12 text-center text-ink-muted">Nothing approved is waiting to send.</CardBody>
          </Card>
        ) : (
          <ApprovalQueue entries={sendEntries} selectable={false} />
        )}
      </div>
    </div>
  );
}
