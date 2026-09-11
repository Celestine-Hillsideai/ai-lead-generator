import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";
import { getCompanyDetail } from "../../../../../../lib/database/queries";
import { PageHeader } from "../../../../../../components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "../../../../../../components/ui/card";
import { Badge, TierBadge } from "../../../../../../components/ui/badge";
import { QualificationBreakdown } from "../../../../../../components/leads/qualification-breakdown";
import { EmailDraftCard } from "../../../../../../components/leads/email-draft-card";
import type { CompanyResearchStatus, QualificationTier } from "../../../../../../types/status";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string; companyId: string }>;
}) {
  const { campaignId, companyId } = await params;
  const supabase = await createSupabaseServerClient();

  let detail;
  try {
    detail = await getCompanyDetail(supabase, companyId);
  } catch {
    notFound();
  }

  const { company, findings, contacts, qualification, emailDrafts } = detail;
  const revalidatePathTarget = `/campaigns/${campaignId}/leads/${companyId}`;
  const allFindings = findings.map((f) => ({
    id: f.id,
    claim: f.claim,
    evidence: f.evidence,
    sourceUrl: null,
    factType: f.fact_type,
    confidence: f.confidence,
  }));

  return (
    <div>
      <PageHeader
        title={company.name}
        description={company.website}
        actions={
          <>
            <Badge tone="neutral">{(company.research_status as CompanyResearchStatus).replaceAll("_", " ")}</Badge>
            {company.qualification_tier && <TierBadge tier={company.qualification_tier as QualificationTier} />}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Company intelligence</CardTitle>
            </CardHeader>
            <CardBody className="space-y-2 text-sm">
              <p className="text-ink-muted">{company.description || "No summary yet."}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {company.industry && <Badge>{company.industry}</Badge>}
                {company.location && <Badge>{company.location}</Badge>}
                {company.employee_size && <Badge>{company.employee_size}</Badge>}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Research findings ({findings.length})</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {findings.length === 0 ? (
                <p className="text-sm text-ink-muted">No findings yet.</p>
              ) : (
                findings.map((f) => (
                  <div key={f.id} className="rounded-lg border border-border p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge tone="evidence">{f.fact_type}</Badge>
                      {f.confidence !== null && (
                        <span className="text-xs text-ink-faint">{Math.round(f.confidence * 100)}%</span>
                      )}
                    </div>
                    <p className="text-sm text-ink">{f.claim}</p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {emailDrafts.map((draft) => (
            <EmailDraftCard
              key={draft.id}
              draft={draft}
              allFindings={allFindings}
              revalidatePathTarget={revalidatePathTarget}
            />
          ))}
        </div>

        <div className="space-y-6">
          {qualification && (
            <Card>
              <CardHeader>
                <CardTitle>Score breakdown ({qualification.score})</CardTitle>
              </CardHeader>
              <CardBody>
                <QualificationBreakdown qualification={qualification} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Decision makers ({contacts.length})</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {contacts.length === 0 ? (
                <p className="text-sm text-ink-muted">No decision makers found yet.</p>
              ) : (
                contacts.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium text-ink">{c.full_name}</p>
                    <p className="text-xs text-ink-muted">{c.title}</p>
                    {c.email && (
                      <p className="mt-1 text-xs text-ink-muted">
                        {c.email} <Badge tone="neutral">{c.email_status}</Badge>
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
