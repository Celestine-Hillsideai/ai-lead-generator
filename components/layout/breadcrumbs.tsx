import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  /** Omit on the last (current-page) item. */
  href?: string;
}

/**
 * Path navigation for pages nested under a top-level sidebar section (e.g.
 * Campaigns > Acme Corp > Leads), which otherwise have no way back except
 * the browser's own back button. When there's a parent to go back to, shows
 * a bordered "← Back" button (not just a plain text link) alongside the
 * full breadcrumb trail, so the way back is immediately obvious even
 * without reading the trail.
 */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const parent = items.length > 1 ? items[items.length - 2] : undefined;

  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-3 text-sm">
      {parent?.href && (
        <Link
          href={parent.href}
          aria-label={`Back to ${parent.label}`}
          className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-paper-raised px-2.5 py-1 font-medium text-ink-muted transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700"
        >
          <span aria-hidden="true">←</span>
          Back
        </Link>
      )}
      <span className="flex flex-wrap items-center gap-1.5">
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
      </span>
    </nav>
  );
}
