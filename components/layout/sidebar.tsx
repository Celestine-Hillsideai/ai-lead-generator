"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../../lib/utils/cn";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/approvals", label: "Approvals" },
  { href: "/settings", label: "Settings" },
];

const HELP_ITEM = { href: "/help", label: "Getting started" };

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-accent-50 text-accent-700" : "text-ink-muted hover:bg-paper-sunken hover:text-ink"
      )}
    >
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-paper-raised">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <span className="font-display text-lg font-semibold text-ink">Lead Generator</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} active={isActive(item.href)} />
        ))}
      </nav>
      <div className="space-y-1 border-t border-border px-3 py-4">
        <NavLink href={HELP_ITEM.href} label={HELP_ITEM.label} active={isActive(HELP_ITEM.href)} />
      </div>
    </aside>
  );
}
