/**
 * Shared dedupe logic for anything that lands companies in the `companies`
 * table by normalized domain -- CSV import (app/actions/leads.ts) and
 * automated sourcing (trigger/sourcing-workflow.ts) both call this, so a
 * domain that's already in a campaign (or repeated within the same batch)
 * is never inserted twice, on either path.
 */
export function dedupeByDomain<T extends { normalizedDomain: string }>(
  candidates: T[],
  existingDomains: ReadonlySet<string>
): { toInsert: T[]; duplicateCount: number } {
  const seen = new Set(existingDomains);
  const toInsert: T[] = [];
  let duplicateCount = 0;

  for (const candidate of candidates) {
    if (seen.has(candidate.normalizedDomain)) {
      duplicateCount++;
      continue;
    }
    seen.add(candidate.normalizedDomain);
    toInsert.push(candidate);
  }

  return { toInsert, duplicateCount };
}
