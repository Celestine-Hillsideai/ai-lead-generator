-- User-level settings (spec §7: AI provider, model, research limits,
-- qualification weights, sender information, email provider), and an
-- email-draft audit trail (spec §19: "record approval/rejection timestamps
-- and state changes"). One settings row per user, created lazily on first
-- write (no default-row-per-signup trigger -- the app falls back to the
-- same env-var defaults it already uses when no row exists).

create table public.user_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  ai_provider text not null default 'openai'
    check (ai_provider in ('openai', 'anthropic')),
  ai_model text,
  email_provider text not null default 'mock'
    check (email_provider in ('mock', 'resend')),
  max_pages_per_company integer not null default 15
    check (max_pages_per_company > 0),
  max_companies_per_campaign integer not null default 200
    check (max_companies_per_campaign > 0),
  qualification_weights jsonb not null default '{
    "industryFit": 0.25,
    "companySize": 0.15,
    "geographicFit": 0.10,
    "problemOpportunity": 0.25,
    "decisionMakerFit": 0.15,
    "buyingSignal": 0.10
  }'::jsonb,
  sender_name text,
  sender_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy user_settings_owner_all on public.user_settings
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Email draft audit trail: one row per status transition (and per
-- edit/regenerate), who did it, when. email_drafts.status still holds the
-- current state; this table is the history spec §19 asks for.
create table public.email_draft_events (
  id uuid primary key default gen_random_uuid(),
  email_draft_id uuid not null references public.email_drafts (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_user_id uuid references public.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index idx_email_draft_events_email_draft_id on public.email_draft_events (email_draft_id);

alter table public.email_draft_events enable row level security;

-- Readable/insertable by whoever owns the campaign the draft belongs to.
create policy email_draft_events_owner_select on public.email_draft_events
  for select
  using (exists (
    select 1 from public.email_drafts ed
    join public.campaigns c on c.id = ed.campaign_id
    where ed.id = email_draft_events.email_draft_id and c.user_id = auth.uid()
  ));

create policy email_draft_events_owner_insert on public.email_draft_events
  for insert
  with check (exists (
    select 1 from public.email_drafts ed
    join public.campaigns c on c.id = ed.campaign_id
    where ed.id = email_draft_events.email_draft_id and c.user_id = auth.uid()
  ));
