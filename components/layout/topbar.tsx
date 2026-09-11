import { signOutAction } from "../../app/actions/auth";
import { Button } from "../ui/button";

export function Topbar({ userEmail }: { userEmail: string | null }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-4 border-b border-border bg-paper-raised px-6">
      {userEmail && <span className="text-sm text-ink-muted">{userEmail}</span>}
      <form action={signOutAction}>
        <Button type="submit" variant="ghost" size="sm">
          Sign out
        </Button>
      </form>
    </header>
  );
}
