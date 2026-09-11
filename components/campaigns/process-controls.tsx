"use client";

import { useTransition } from "react";
import { startProcessingAction, pauseCampaignAction, resumeCampaignAction } from "../../app/actions/campaigns";
import { Button } from "../ui/button";
import type { CampaignStatus } from "../../types/status";

export function ProcessControls({ campaignId, status }: { campaignId: string; status: CampaignStatus }) {
  const [isPending, startTransition] = useTransition();

  // startTransition's callback must return void | Promise<void> -- our
  // server actions return { error? } for form-style error display, so wrap
  // and discard the result here rather than surfacing it (errors from these
  // buttons are rare operational failures; the page-level revalidation
  // reflects the actual outcome either way).
  const run = (action: () => Promise<{ error?: string }>) => {
    startTransition(async () => {
      await action();
    });
  };

  if (status === "DRAFT" || status === "READY") {
    return (
      <Button disabled={isPending} onClick={() => run(() => startProcessingAction(campaignId))}>
        {isPending ? "Starting…" : "Start processing"}
      </Button>
    );
  }

  if (status === "PROCESSING") {
    return (
      <Button variant="secondary" disabled={isPending} onClick={() => run(() => pauseCampaignAction(campaignId))}>
        {isPending ? "Pausing…" : "Pause"}
      </Button>
    );
  }

  if (status === "PAUSED") {
    return (
      <Button disabled={isPending} onClick={() => run(() => resumeCampaignAction(campaignId))}>
        {isPending ? "Resuming…" : "Resume"}
      </Button>
    );
  }

  return null;
}
