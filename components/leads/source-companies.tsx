"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startCompanySourcingAction,
  getSourcingRunStatusAction,
  type StartSourcingResult,
  type SourcingRunStatus,
} from "../../app/actions/sourcing";
import { Button } from "../ui/button";
import { Card, CardBody } from "../ui/card";
import { Input, Label } from "../ui/input";
import type { CampaignRow } from "../../lib/database/repository";

const POLL_INTERVAL_MS = 3000;

interface InitialRun {
  id: string;
  status: SourcingRunStatus["status"];
}

export function SourceCompanies({
  campaignId,
  campaign,
  remainingCapacity,
  initialRun,
}: {
  campaignId: string;
  campaign: Pick<CampaignRow, "industry" | "geography" | "company_size" | "target_roles" | "offer_description">;
  remainingCapacity: number;
  initialRun: InitialRun | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<StartSourcingResult, FormData>(
    async (_prev, formData) => startCompanySourcingAction(campaignId, formData),
    {}
  );

  const [runId, setRunId] = useState<string | null>(
    initialRun && initialRun.status !== "SUCCEEDED" && initialRun.status !== "FAILED" ? initialRun.id : null
  );
  const [runStatus, setRunStatus] = useState<SourcingRunStatus | null>(null);
  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    if (state.sourcingRunId) {
      setRunId(state.sourcingRunId);
      hasRefreshedRef.current = false;
    }
  }, [state.sourcingRunId]);

  useEffect(() => {
    if (!runId) return;

    let cancelled = false;
    const poll = async () => {
      const result = await getSourcingRunStatusAction(runId);
      if (cancelled) return;
      if (!("status" in result)) return;

      setRunStatus(result);
      if (result.status === "SUCCEEDED" || result.status === "FAILED") {
        if (!hasRefreshedRef.current) {
          hasRefreshedRef.current = true;
          router.refresh();
        }
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [runId, router]);

  const targetRoles = campaign.target_roles.length > 0 ? campaign.target_roles.join(", ") : "any role";
  const defaultTarget = Math.max(1, Math.min(remainingCapacity, 50));
  const isRunning = runStatus ? runStatus.status === "PENDING" || runStatus.status === "RUNNING" : false;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="font-display text-base font-semibold text-ink">Find companies automatically</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Discovers companies matching this campaign&apos;s ICP —{" "}
            <strong>{campaign.industry ?? "any industry"}</strong> in{" "}
            <strong>{campaign.geography ?? "any geography"}</strong>, {campaign.company_size ?? "any size"},
            targeting <strong>{targetRoles}</strong> — instead of requiring an uploaded list.
          </p>
        </div>

        {remainingCapacity <= 0 ? (
          <p className="text-sm text-ink-muted">
            This campaign is already at its company limit. Raise the cap in Settings to source more.
          </p>
        ) : (
          <form action={formAction} className="flex items-end gap-3">
            <div className="max-w-[160px]">
              <Label htmlFor="targetCount">Target count</Label>
              <Input
                id="targetCount"
                name="targetCount"
                type="number"
                min={1}
                max={remainingCapacity}
                defaultValue={defaultTarget}
                required
              />
            </div>
            <Button type="submit" disabled={pending || isRunning} size="sm">
              {pending || isRunning ? "Sourcing…" : "Find companies automatically"}
            </Button>
          </form>
        )}

        <p className="text-xs text-ink-faint">Up to {remainingCapacity} more companies (your campaign&apos;s company limit).</p>

        {state.error && <p className="text-sm text-danger">{state.error}</p>}

        {runStatus && (
          <div className="rounded-lg bg-paper-sunken p-4 text-sm">
            {runStatus.status === "FAILED" ? (
              <p className="text-danger">Sourcing failed: {runStatus.error}</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                <span className="text-ink-muted">
                  Status: <strong className="text-ink">{runStatus.status}</strong>
                </span>
                <span className="text-ink-muted">
                  Discovered <strong className="text-ink">{runStatus.discoveredCount}</strong>
                </span>
                <span className="text-ink-muted">
                  Inserted <strong className="text-ink">{runStatus.insertedCount}</strong>
                </span>
                <span className="text-ink-muted">
                  Skipped <strong className="text-ink">{runStatus.skippedCount}</strong>
                </span>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
