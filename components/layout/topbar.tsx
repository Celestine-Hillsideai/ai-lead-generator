"use client";

import { useRouter } from "next/navigation";
import { signOutAction } from "../../app/actions/auth";
import { Button } from "../ui/button";

/** Always-visible back/forward navigation, present on every page via the shared (app) layout -- unlike the per-page breadcrumb (which only has a "back" target on pages nested under Campaigns), this works everywhere using the browser's own navigation history. */
export function Topbar({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-paper-raised px-6">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          title="Go back"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-lg text-ink-muted transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
        >
          ←
        </button>
        <button
          type="button"
          onClick={() => router.forward()}
          aria-label="Go forward"
          title="Go forward"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-lg text-ink-muted transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
        >
          →
        </button>
      </div>

      <div className="flex items-center gap-4">
        {userEmail && <span className="text-sm text-ink-muted">{userEmail}</span>}
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
