-- Core data model per docs/spec.md §8. Status/enum-like columns are `text` +
-- `check` constraints (not native Postgres enums) so new values can be added
-- with a plain migration rather than an `alter type`.

-- public.users mirrors auth.users (standard Supabase pattern) rather than a
-- redundant hand-managed table -- kept in sync by the trigger below.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- Campaign (spec §8, §10, §26)
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  description text,
  industry text,
  geography text,
  company_size text,
  target_roles text[] not null default '{}',
  offer_description text,
  value_proposition text,
  cta text,
  research_instructions text,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'READY', 'PROCESSING', 'PAUSED', 'COMPLETED', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Company (spec §8, §26)
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  name text not null,
  website text not null,
  normalized_domain text not null,
  industry text,
  description text,
  location text,
  employee_size text,
  research_status text not null default 'IMPORTED'
    check (research_status in (
      'IMPORTED', 'RESEARCHING', 'RESEARCHED', 'CONTACT_SEARCHING',
      'CONTACT_FOUND', 'QUALIFYING', 'QUALIFIED', 'EMAIL_GENERATING',
      'EMAIL_READY', 'NEEDS_REVIEW', 'APPROVED', 'FAILED'
    )),
  qualification_score numeric,
  qualification_tier text
    check (qualification_tier in ('HIGH', 'MEDIUM', 'LOW', 'UNQUALIFIED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_campaign_domain_unique unique (campaign_id, normalized_domain)
);

-- Contact (spec §8, §14)
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  first_name text,
  last_name text,
  full_name text,
  title text,
  email text,
  email_status text
    check (email_status in ('verified', 'public', 'unverified', 'invalid', 'unknown')),
  source_url text,
  confidence numeric,
  created_at timestamptz not null default now()
);

-- ResearchSource (spec §8, §12)
create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  url text not null,
  title text,
  source_type text,
  retrieved_at timestamptz not null default now(),
  content_hash text
);

-- ResearchFinding (spec §8, §13, §18)
create table public.research_findings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  source_id uuid references public.research_sources (id) on delete set null,
  category text,
  claim text not null,
  evidence text not null,
  confidence numeric,
  fact_type text not null
    check (fact_type in ('FACT', 'INFERENCE', 'UNKNOWN')),
  created_at timestamptz not null default now()
);

-- Qualification (spec §8, §15)
create table public.qualifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  score numeric not null,
  tier text not null
    check (tier in ('HIGH', 'MEDIUM', 'LOW', 'UNQUALIFIED')),
  industry_score numeric,
  size_score numeric,
  geography_score numeric,
  problem_score numeric,
  decision_maker_score numeric,
  buying_signal_score numeric,
  reasons jsonb not null default '[]',
  risk_flags jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- EmailDraft (spec §8, §17, §18, §19, §26)
create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  contact_id uuid references public.contacts (id) on delete set null,
  subject text not null,
  body text not null,
  personalization_hook text,
  evidence_ids uuid[] not null default '{}',
  confidence numeric,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'READY', 'APPROVED', 'REJECTED', 'SENDING', 'SENT', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AgentRun (spec §8, §21) -- one row per agent invocation, for observability
-- and retry tracking independent of Trigger.dev's own run history.
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  agent_type text not null
    check (agent_type in ('research', 'decision_maker', 'qualification', 'personalization', 'email')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
  input jsonb,
  output jsonb,
  error text,
  retry_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz
);

-- Suppression (spec §8, §20) -- scoped to a user (global do-not-contact) and/or
-- a specific campaign; at least one scope must be set.
create table public.suppressions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  email text not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint suppressions_scope_required check (user_id is not null or campaign_id is not null)
);
