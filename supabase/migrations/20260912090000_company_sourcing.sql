-- Automated company/prospect sourcing (docs/spec.md §11A). One
-- `sourcing_runs` row per "Find companies automatically" click, giving the
-- frontend something to poll for progress; discovered companies land in
-- `companies` with the same `research_status = 'IMPORTED'` shape CSV import
-- already produces, distinguished only by the new audit columns below so
-- trigger/research-workflow.ts needs zero changes to pick them up.

create table public.sourcing_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  requested_by uuid not null references public.users (id) on delete cascade,
  provider text not null,
  target_count integer not null check (target_count > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  discovered_count integer not null default 0,
  inserted_count integer not null default 0,
  skipped_count integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index idx_sourcing_runs_campaign_id on public.sourcing_runs (campaign_id);

alter table public.sourcing_runs enable row level security;

create policy sourcing_runs_owner_all on public.sourcing_runs
  for all
  using (exists (select 1 from public.campaigns c where c.id = sourcing_runs.campaign_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.campaigns c where c.id = sourcing_runs.campaign_id and c.user_id = auth.uid()));

-- Distinguishes auto-sourced companies from CSV-imported ones for
-- auditability -- purely descriptive, research_status is unaffected.
alter table public.companies
  add column source_type text not null default 'csv_import'
    check (source_type in ('csv_import', 'auto_sourced')),
  add column source_provider text,
  add column sourcing_run_id uuid references public.sourcing_runs (id) on delete set null;

create index idx_companies_sourcing_run_id on public.companies (sourcing_run_id);

-- Per-sourcing-run cap, same convention as max_companies_per_campaign.
alter table public.user_settings
  add column max_companies_per_sourcing_run integer not null default 50
    check (max_companies_per_sourcing_run > 0);
