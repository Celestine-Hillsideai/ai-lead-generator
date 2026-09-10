-- Row Level Security per docs/spec.md §9: users must only access their own
-- campaigns and associated records. These policies govern the `anon`/
-- `authenticated` roles a future frontend will use; the Trigger.dev pipeline
-- always connects with the service-role key, which bypasses RLS entirely by
-- Supabase design, so these policies don't need to (and can't) gate it.

alter table public.users enable row level security;
alter table public.campaigns enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_findings enable row level security;
alter table public.qualifications enable row level security;
alter table public.email_drafts enable row level security;
alter table public.agent_runs enable row level security;
alter table public.suppressions enable row level security;

-- users: a user can read/update only their own row.
create policy users_select_own on public.users
  for select using (id = auth.uid());
create policy users_update_own on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- campaigns: direct ownership via user_id.
create policy campaigns_owner_all on public.campaigns
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- companies: ownership via the parent campaign.
create policy companies_owner_all on public.companies
  for all
  using (exists (
    select 1 from public.campaigns c
    where c.id = companies.campaign_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.campaigns c
    where c.id = companies.campaign_id and c.user_id = auth.uid()
  ));

-- contacts: ownership via company -> campaign.
create policy contacts_owner_all on public.contacts
  for all
  using (exists (
    select 1 from public.companies co
    join public.campaigns c on c.id = co.campaign_id
    where co.id = contacts.company_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.companies co
    join public.campaigns c on c.id = co.campaign_id
    where co.id = contacts.company_id and c.user_id = auth.uid()
  ));

-- research_sources: ownership via company -> campaign.
create policy research_sources_owner_all on public.research_sources
  for all
  using (exists (
    select 1 from public.companies co
    join public.campaigns c on c.id = co.campaign_id
    where co.id = research_sources.company_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.companies co
    join public.campaigns c on c.id = co.campaign_id
    where co.id = research_sources.company_id and c.user_id = auth.uid()
  ));

-- research_findings: ownership via company -> campaign.
create policy research_findings_owner_all on public.research_findings
  for all
  using (exists (
    select 1 from public.companies co
    join public.campaigns c on c.id = co.campaign_id
    where co.id = research_findings.company_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.companies co
    join public.campaigns c on c.id = co.campaign_id
    where co.id = research_findings.company_id and c.user_id = auth.uid()
  ));

-- qualifications: ownership via company -> campaign.
create policy qualifications_owner_all on public.qualifications
  for all
  using (exists (
    select 1 from public.companies co
    join public.campaigns c on c.id = co.campaign_id
    where co.id = qualifications.company_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.companies co
    join public.campaigns c on c.id = co.campaign_id
    where co.id = qualifications.company_id and c.user_id = auth.uid()
  ));

-- email_drafts: direct ownership via campaign_id.
create policy email_drafts_owner_all on public.email_drafts
  for all
  using (exists (
    select 1 from public.campaigns c
    where c.id = email_drafts.campaign_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.campaigns c
    where c.id = email_drafts.campaign_id and c.user_id = auth.uid()
  ));

-- agent_runs: direct ownership via campaign_id.
create policy agent_runs_owner_all on public.agent_runs
  for all
  using (exists (
    select 1 from public.campaigns c
    where c.id = agent_runs.campaign_id and c.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.campaigns c
    where c.id = agent_runs.campaign_id and c.user_id = auth.uid()
  ));

-- suppressions: owned directly (user_id) or via campaign_id.
create policy suppressions_owner_all on public.suppressions
  for all
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      where c.id = suppressions.campaign_id and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.campaigns c
      where c.id = suppressions.campaign_id and c.user_id = auth.uid()
    )
  );
