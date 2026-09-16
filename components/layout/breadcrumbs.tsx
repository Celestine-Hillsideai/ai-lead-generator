import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  /** Omit on the last (current-page) item. */
  href?: string;
}

/** Path navigation for pages nested under a top-level sidebar section (e.g. Campaigns > Acme Corp > Leads), which otherwise have no way back except the browser's own back button. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ink-faint">/</span>}
          {item.href ? (
            <Link href={item.href} className="text-ink-muted hover:text-ink hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-ink">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
