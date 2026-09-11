"use client";

import { useState, useTransition } from "react";
import {
  approveEmailAction,
  rejectEmailAction,
  editEmailAction,
  regenerateEmailAction,
  sendEmailAction,
} from "../../app/actions/emails";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input, Textarea, Label } from "../ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "../ui/card";
import { EvidenceDrawer, type EvidenceFinding } from "./evidence-drawer";
import { DraftHistory, type DraftEvent } from "./draft-history";

export interface EmailDraftData {
  id: string;
  subject: string;
  body: string;
  personalization_hook: string | null;
  evidence_ids: string[];
  confidence: number | null;
  status: string;
}

/** Bulk-approval eligibility, per docs/spec.md §19 -- kept in sync with the server-side floor in app/actions/emails.ts. */
export const BULK_APPROVE_MIN_CONFIDENCE = 0.8;

const STATUS_TONE: Record<string, "neutral" | "success" | "danger" | "accent"> = {
  DRAFT: "neutral",
  READY: "accent",
  APPROVED: "success",
  REJECTED: "danger",
  SENDING: "accent",
  SENT: "success",
  FAILED: "danger",
};

export interface EmailRecipient {
  fullName: string | null;
  email: string | null;
  emailStatus: string | null;
}

export function EmailDraftCard({
  draft,
  allFindings,
  revalidatePathTarget,
  history = [],
  selectable = false,
  selected = false,
  onToggleSelect,
  recipient = null,
}: {
  draft: EmailDraftData;
  allFindings: EvidenceFinding[];
  revalidatePathTarget: string;
  history?: DraftEvent[];
  /** Approvals queue passes these to enable bulk-approve checkboxes; the lead detail page omits them. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (draftId: string) => void;
  /** The contact this draft was written for (draft.contact_id) -- shown next to the Send action. */
  recipient?: EmailRecipient | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [error, setError] = useState<string | null>(null);

  const canAct = draft.status === "READY";
  const bulkEligible = canAct && (draft.confidence ?? 0) >= BULK_APPROVE_MIN_CONFIDENCE;
  const canSend = draft.status === "APPROVED";
  const sendBlockedReason =
    !recipient?.email ? "No recipient email on file." : recipient.emailStatus === "invalid" ? "Recipient email is invalid." : null;

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              disabled={!bulkEligible}
              onChange={() => onToggleSelect?.(draft.id)}
              title={bulkEligible ? "Select for bulk approval" : `Only drafts at ${Math.round(BULK_APPROVE_MIN_CONFIDENCE * 100)}%+ confidence are bulk-approvable`}
              className="h-4 w-4 rounded border-border-strong accent-accent-500"
            />
          )}
          <CardTitle>Email draft</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {draft.confidence !== null && (
            <span className="text-xs text-ink-faint">{Math.round(draft.confidence * 100)}% confidence</span>
          )}
          <Badge tone={STATUS_TONE[draft.status] ?? "neutral"}>{draft.status}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {editing ? (
          <>
            <div>
              <Label htmlFor={`subject-${draft.id}`}>Subject</Label>
              <Input id={`subject-${draft.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor={`body-${draft.id}`}>Body</Label>
              <Textarea id={`body-${draft.id}`} value={body} onChange={(e) => setBody(e.target.value)} className="min-h-40" />
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Subject</p>
              <p className="mt-1 text-sm text-ink">{draft.subject}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Body</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{draft.body}</p>
            </div>
          </>
        )}

        {draft.personalization_hook && (
          <Badge tone="evidence">Personalization: {draft.personalization_hook}</Badge>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <EvidenceDrawer evidenceIds={draft.evidence_ids} allFindings={allFindings} />

          {editing ? (
            <>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(async () => {
                    const r = await editEmailAction(draft.id, { subject, body }, revalidatePathTarget);
                    if (!r.error) setEditing(false);
                    return r;
                  })
                }
              >
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            canAct && (
              <>
                <Button size="sm" disabled={isPending} onClick={() => run(() => approveEmailAction(draft.id, revalidatePathTarget))}>
                  Approve
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={() => run(() => rejectEmailAction(draft.id, revalidatePathTarget))}
                >
                  Reject
                </Button>
                <Button variant="secondary" size="sm" disabled={isPending} onClick={() => setEditing(true)}>
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => run(() => regenerateEmailAction(draft.id, revalidatePathTarget))}
                >
                  {isPending ? "Regenerating…" : "Regenerate"}
                </Button>
              </>
            )
          )}

          {canSend && (
            <>
              <Button
                size="sm"
                disabled={isPending || !!sendBlockedReason}
                title={sendBlockedReason ?? undefined}
                onClick={() => run(() => sendEmailAction(draft.id, revalidatePathTarget))}
              >
                {isPending ? "Sending…" : "Send"}
              </Button>
              <span className="text-xs text-ink-faint">
                {recipient?.email
                  ? `to ${recipient.fullName ? `${recipient.fullName} ` : ""}<${recipient.email}>`
                  : sendBlockedReason}
              </span>
            </>
          )}

          {(draft.status === "SENT" || draft.status === "FAILED") && recipient?.email && (
            <span className="text-xs text-ink-faint">
              {draft.status === "SENT" ? "Sent" : "Failed to send"} to {recipient.fullName ? `${recipient.fullName} ` : ""}
              &lt;{recipient.email}&gt;
            </span>
          )}
        </div>

        <DraftHistory events={history} />
      </CardBody>
    </Card>
  );
}
