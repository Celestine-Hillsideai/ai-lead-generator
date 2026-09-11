import Link from "next/link";
import { Button } from "../components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-4 text-center">
      <h1 className="font-display text-2xl font-semibold text-ink">Not found</h1>
      <p className="text-sm text-ink-muted">This page, campaign, or lead doesn&apos;t exist.</p>
      <Link href="/dashboard">
        <Button variant="secondary">Back to dashboard</Button>
      </Link>
    </div>
  );
}
