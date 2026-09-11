"use client";

import { useState, useTransition } from "react";
import { bulkApproveEmailsAction } from "../../app/actions/emails";
import { Button } from "../ui/button";
import { EmailDraftCard, BULK_APPROVE_MIN_CONFIDENCE, type EmailDraftData } from "./email-draft-card";
import type { EvidenceFinding } from "./evidence-drawer";
import type { DraftEvent } from "./draft-history";

export interface ApprovalQueueEntry {
  draft: EmailDraftData;
  campaignName: string;
  companyName: string;
  findings: EvidenceFinding[];
  history: DraftEvent[];
}

/** Approval queue with bulk-approve, per docs/spec.md §19 ("restricted to high-confidence records"). */
export function ApprovalQueue({ entries }: { entries: ApprovalQueueEntry[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const eligible = entries.filter(
    (e) => e.draft.status === "READY" && (e.draft.confidence ?? 0) >= BULK_APPROVE_MIN_CONFIDENCE
  );

  function toggle(draftId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(draftId)) next.delete(draftId);
      else next.add(draftId);
      return next;
    });
  }

  function selectAllEligible() {
    setSelected(new Set(eligible.map((e) => e.draft.id)));
  }

  function bulkApprove() {
    setMessage(null);
    startTransition(async () => {
      const result = await bulkApproveEmailsAction(Array.from(selected), "/approvals");
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage(
        `Approved ${result.approvedIds?.length ?? 0} draft(s).` +
          (result.skippedIds && result.skippedIds.length > 0
            ? ` ${result.skippedIds.length} skipped (below ${Math.round(BULK_APPROVE_MIN_CONFIDENCE * 100)}% confidence or no longer pending).`
            : "")
      );
      setSelected(new Set());
    });
  }

  return (
    <div className="space-y-4">
      {eligible.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-border bg-paper-sunken p-4">
          <span className="text-sm text-ink-muted">
            {selected.size} selected · {eligible.length} eligible for bulk approval (≥{Math.round(BULK_APPROVE_MIN_CONFIDENCE * 100)}% confidence)
          </span>
          <Button variant="secondary" size="sm" onClick={selectAllEligible}>
            Select all eligible
          </Button>
          <Button size="sm" disabled={selected.size === 0 || isPending} onClick={bulkApprove}>
            {isPending ? "Approving…" : `Approve selected (${selected.size})`}
          </Button>
          {message && <span className="text-sm text-ink">{message}</span>}
        </div>
      )}

      {entries.map(({ draft, campaignName, companyName, findings, history }) => (
        <div key={draft.id}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
            {campaignName} · {companyName}
          </p>
          <EmailDraftCard
            draft={draft}
            allFindings={findings}
            revalidatePathTarget="/approvals"
            history={history}
            selectable
            selected={selected.has(draft.id)}
            onToggleSelect={toggle}
          />
        </div>
      ))}
    </div>
  );
}
