import { formatRelativeTime } from "../../lib/utils/format";

export interface DraftEvent {
  id: string;
  from_status: string | null;
  to_status: string;
  actor_user_id: string | null;
  note: string | null;
  created_at: string;
}

/** Audit trail display, per docs/spec.md §19. */
export function DraftHistory({ events }: { events: DraftEvent[] }) {
  if (events.length === 0) return null;

  return (
    <details className="text-xs text-ink-muted">
      <summary className="cursor-pointer select-none font-medium text-ink-muted hover:text-ink">
        History ({events.length})
      </summary>
      <ul className="mt-2 space-y-1 border-l-2 border-border pl-3">
        {events.map((e) => (
          <li key={e.id}>
            {e.from_status ? `${e.from_status} → ${e.to_status}` : e.to_status}
            {e.note ? ` (${e.note})` : ""} · {formatRelativeTime(e.created_at)}
          </li>
        ))}
      </ul>
    </details>
  );
}
