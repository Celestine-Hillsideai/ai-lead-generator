"use client";

import { useActionState, useRef } from "react";
import { importLeadsAction, type ImportLeadsResult } from "../../app/actions/leads";
import { Button } from "../ui/button";
import { Card, CardBody } from "../ui/card";
import { Badge } from "../ui/badge";

export function CsvImport({ campaignId }: { campaignId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ImportLeadsResult, FormData>(
    async (_prev, formData) => importLeadsAction(campaignId, formData),
    {}
  );

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Import leads</h2>
          <p className="mt-1 text-sm text-ink-muted">
            CSV with columns <code className="rounded bg-paper-sunken px-1 py-0.5">company_name</code>,{" "}
            <code className="rounded bg-paper-sunken px-1 py-0.5">website</code> (required), plus optional{" "}
            <code className="rounded bg-paper-sunken px-1 py-0.5">industry</code>,{" "}
            <code className="rounded bg-paper-sunken px-1 py-0.5">location</code>,{" "}
            <code className="rounded bg-paper-sunken px-1 py-0.5">notes</code>.
          </p>
        </div>

        <form
          ref={formRef}
          action={(formData) => {
            formAction(formData);
          }}
          className="flex items-center gap-3"
        >
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-sm text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent-700 hover:file:bg-accent-100"
          />
          <Button type="submit" disabled={pending} size="sm">
            {pending ? "Importing…" : "Import"}
          </Button>
        </form>

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        {state.stats && (
          <div className="rounded-lg bg-paper-sunken p-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="text-ink">
                <strong>{state.stats.insertedIntoDb}</strong> imported
              </span>
              <span className="text-ink-muted">
                <strong>{state.stats.duplicate}</strong> duplicate
              </span>
              <span className="text-ink-muted">
                <strong>{state.stats.invalid}</strong> invalid
              </span>
            </div>
            {state.rowIssues && state.rowIssues.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-ink-muted">
                {state.rowIssues.slice(0, 10).map((issue, i) => (
                  <li key={i}>
                    <Badge tone={issue.status === "invalid" ? "danger" : "neutral"} className="mr-2">
                      Row {issue.row}
                    </Badge>
                    {issue.reason}
                  </li>
                ))}
                {state.rowIssues.length > 10 && <li>…and {state.rowIssues.length - 10} more</li>}
              </ul>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
