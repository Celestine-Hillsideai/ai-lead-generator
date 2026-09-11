import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { toCsv } from "../../../../../lib/utils/csv-export";

/** Approved-only CSV export, per docs/spec.md §9/Phase 9. RLS scopes this to the caller's own campaign. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("id", campaignId)
    .single();
  if (campaignError || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { data: drafts, error } = await supabase
    .from("email_drafts")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("status", "APPROVED");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const companyIds = (drafts ?? []).map((d) => d.company_id);
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, website, qualification_score, qualification_tier")
    .in("id", companyIds.length > 0 ? companyIds : ["00000000-0000-0000-0000-000000000000"]);
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));

  const contactIds = (drafts ?? []).map((d) => d.contact_id).filter((id): id is string => id !== null);
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, email")
    .in("id", contactIds.length > 0 ? contactIds : ["00000000-0000-0000-0000-000000000000"]);
  const contactById = new Map((contacts ?? []).map((c) => [c.id, c]));

  const headers = [
    "company_name",
    "website",
    "qualification_score",
    "qualification_tier",
    "contact_name",
    "contact_email",
    "subject",
    "body",
    "confidence",
  ];

  const rows = (drafts ?? []).map((d) => {
    const company = companyById.get(d.company_id);
    const contact = d.contact_id ? contactById.get(d.contact_id) : null;
    return [
      company?.name ?? "",
      company?.website ?? "",
      company?.qualification_score ?? "",
      company?.qualification_tier ?? "",
      contact?.full_name ?? "",
      contact?.email ?? "",
      d.subject,
      d.body,
      d.confidence ?? "",
    ];
  });

  const csv = toCsv(headers, rows);
  const filename = `${campaign.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-approved-leads.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
