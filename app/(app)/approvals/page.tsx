import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { getApprovalQueue } from "../../../lib/database/queries";
import { PageHeader } from "../../../components/layout/page-header";
import { Card, CardBody } from "../../../components/ui/card";
import { EmailDraftCard } from "../../../components/leads/email-draft-card";

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

  return (
    <div>
      <PageHeader
        title="Approvals"
        description={`${queue.length} email${queue.length === 1 ? "" : "s"} awaiting review across all campaigns.`}
      />

      {queue.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-ink-muted">Nothing needs review right now.</CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {queue.map((draft) => (
            <div key={draft.id}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
                {draft.campaignName} · {draft.company?.name ?? "Unknown company"}
              </p>
              <EmailDraftCard
                draft={draft}
                allFindings={(findingsByCompany.get(draft.company_id) ?? []).map((f) => ({
                  id: f.id,
                  claim: f.claim,
                  evidence: f.evidence,
                  sourceUrl: null,
                  factType: f.fact_type,
                  confidence: f.confidence,
                }))}
                revalidatePathTarget="/approvals"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
