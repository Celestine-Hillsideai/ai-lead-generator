"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { validateCsvContent } from "../../lib/validation/csv";
import { dedupeByDomain } from "../../lib/leads/dedupe";

export interface ImportLeadsResult {
  error?: string;
  stats?: { accepted: number; rejected: number; duplicate: number; invalid: number; insertedIntoDb: number };
  rowIssues?: { row: number; status: string; reason?: string }[];
}

export async function importLeadsAction(campaignId: string, formData: FormData): Promise<ImportLeadsResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file uploaded." };

  const text = await file.text();

  let summary: ReturnType<typeof validateCsvContent>;
  try {
    summary = validateCsvContent(text);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to parse CSV." };
  }

  const supabase = await createSupabaseServerClient();

  // Skip rows whose normalized domain is already imported for this campaign
  // (the DB's unique constraint would reject them anyway; check here so we
  // can report it as "duplicate" instead of a generic insert failure).
  const { data: existing } = await supabase
    .from("companies")
    .select("normalized_domain")
    .eq("campaign_id", campaignId);
  const existingDomains = new Set((existing ?? []).map((c) => c.normalized_domain));

  const accepted = summary.results.filter((r) => r.status === "accepted" && r.data);
  const { toInsert, duplicateCount: alreadyImported } = dedupeByDomain(
    accepted.map((r) => ({ ...r, normalizedDomain: r.data!.normalizedDomain })),
    existingDomains
  );

  let insertedIntoDb = 0;
  if (toInsert.length > 0) {
    const { error, data } = await supabase
      .from("companies")
      .insert(
        toInsert.map((r) => ({
          campaign_id: campaignId,
          name: r.data!.companyName,
          website: r.data!.website,
          normalized_domain: r.data!.normalizedDomain,
          industry: r.data!.industry ?? null,
          location: r.data!.location ?? null,
          research_status: "IMPORTED" as const,
        }))
      )
      .select("id");
    if (error) return { error: `Import failed: ${error.message}` };
    insertedIntoDb = data?.length ?? 0;
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/leads`);

  return {
    stats: {
      accepted: accepted.length,
      rejected: 0,
      duplicate: summary.stats.duplicate + alreadyImported,
      invalid: summary.stats.invalid,
      insertedIntoDb,
    },
    rowIssues: summary.results
      .filter((r) => r.status !== "accepted")
      .map((r) => ({ row: r.row, status: r.status, reason: r.reason })),
  };
}
