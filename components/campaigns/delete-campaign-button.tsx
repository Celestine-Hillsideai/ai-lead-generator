"use client";

import { useState, useTransition } from "react";
import { deleteCampaignAction } from "../../app/actions/campaigns";
import { Button } from "../ui/button";

export function DeleteCampaignButton({
  campaignId,
  campaignName,
  size = "md",
}: {
  campaignId: string;
  campaignName: string;
  size?: "sm" | "md" | "lg";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <Button
        variant="danger"
        size={size}
        disabled={isPending}
        onClick={(e) => {
          e.preventDefault(); // in case this renders inside a Link-wrapped card
          e.stopPropagation();
          if (!window.confirm(`Delete "${campaignName}"? This permanently deletes its companies, research, contacts, and email drafts. This cannot be undone.`)) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await deleteCampaignAction(campaignId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? "Deleting…" : "Delete"}
      </Button>
    </div>
  );
}
