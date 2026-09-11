"use client";

import { useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export interface EvidenceFinding {
  id: string;
  claim: string;
  evidence: string;
  sourceUrl: string | null;
  factType: string;
  confidence: number | null;
}

/**
 * Evidence drawer, per docs/spec.md §18: lets the reviewer trace an email's
 * personalization back to the exact source evidence. Opens a panel listing
 * every research finding referenced by evidenceIds, each showing the
 * claim, the quoted evidence, its source URL, and fact type -- the full
 * provenance chain, not just "trust us."
 */
export function EvidenceDrawer({ evidenceIds, allFindings }: { evidenceIds: string[]; allFindings: EvidenceFinding[] }) {
  const [open, setOpen] = useState(false);
  const matched = allFindings.filter((f) => evidenceIds.includes(f.id));

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        View evidence ({matched.length})
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={() => setOpen(false)}>
          <div
            className="h-full w-full max-w-md overflow-y-auto bg-paper-raised p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-ink">Evidence</h3>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>

            {matched.length === 0 ? (
              <p className="text-sm text-ink-muted">No evidence linked to this draft.</p>
            ) : (
              <div className="space-y-4">
                {matched.map((f) => (
                  <div key={f.id} className="rounded-lg border border-border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge tone="evidence">{f.factType}</Badge>
                      {f.confidence !== null && (
                        <span className="text-xs text-ink-faint">{Math.round(f.confidence * 100)}% confidence</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-ink">{f.claim}</p>
                    <blockquote className="mt-2 border-l-2 border-evidence-400 pl-3 text-sm italic text-ink-muted">
                      &ldquo;{f.evidence}&rdquo;
                    </blockquote>
                    {f.sourceUrl && (
                      <a
                        href={f.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block truncate text-xs text-accent-500 hover:text-accent-600"
                      >
                        {f.sourceUrl}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
