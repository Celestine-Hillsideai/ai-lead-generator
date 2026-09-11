import Link from "next/link";
import { Badge, TierBadge } from "../ui/badge";
import type { CompanyRow } from "../../lib/database/repository";
import type { CompanyResearchStatus, QualificationTier } from "../../types/status";

export function LeadsTable({ campaignId, companies }: { campaignId: string; companies: CompanyRow[] }) {
  if (companies.length === 0) {
    return <p className="text-sm text-ink-muted">No leads imported yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-paper-sunken text-left text-xs font-medium uppercase tracking-wide text-ink-muted">
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Tier</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr key={c.id} className="border-b border-border last:border-0 hover:bg-paper-sunken">
              <td className="px-4 py-3">
                <Link href={`/campaigns/${campaignId}/leads/${c.id}`} className="font-medium text-ink hover:text-accent-500">
                  {c.name}
                </Link>
                <p className="text-xs text-ink-muted">{c.website}</p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={c.research_status as CompanyResearchStatus} />
              </td>
              <td className="px-4 py-3 text-ink">{c.qualification_score ?? "—"}</td>
              <td className="px-4 py-3">
                {c.qualification_tier ? <TierBadge tier={c.qualification_tier as QualificationTier} /> : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: CompanyResearchStatus }) {
  const tone =
    status === "FAILED"
      ? "danger"
      : status === "NEEDS_REVIEW"
        ? "warning"
        : status === "EMAIL_READY" || status === "APPROVED" || status === "QUALIFIED"
          ? "success"
          : status === "IMPORTED"
            ? "neutral"
            : "accent";
  return <Badge tone={tone}>{status.replaceAll("_", " ").toLowerCase()}</Badge>;
}
