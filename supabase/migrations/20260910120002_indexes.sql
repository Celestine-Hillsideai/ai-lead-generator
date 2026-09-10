-- Indexes per docs/spec.md §9: campaignId, companyId, contactId,
-- normalizedDomain, qualificationScore, researchStatus, and email status.
-- (The unique (campaign_id, normalized_domain) constraint on companies is
-- already defined in 20260910120001_core_tables.sql and doubles as an index.)

create index idx_campaigns_user_id on public.campaigns (user_id);
create index idx_campaigns_status on public.campaigns (status);

create index idx_companies_campaign_id on public.companies (campaign_id);
create index idx_companies_normalized_domain on public.companies (normalized_domain);
create index idx_companies_qualification_score on public.companies (qualification_score);
create index idx_companies_research_status on public.companies (research_status);

create index idx_contacts_company_id on public.contacts (company_id);
create index idx_contacts_email_status on public.contacts (email_status);

create index idx_research_sources_company_id on public.research_sources (company_id);

create index idx_research_findings_company_id on public.research_findings (company_id);
create index idx_research_findings_source_id on public.research_findings (source_id);

create index idx_qualifications_company_id on public.qualifications (company_id);

create index idx_email_drafts_campaign_id on public.email_drafts (campaign_id);
create index idx_email_drafts_company_id on public.email_drafts (company_id);
create index idx_email_drafts_contact_id on public.email_drafts (contact_id);
create index idx_email_drafts_status on public.email_drafts (status);

create index idx_agent_runs_campaign_id on public.agent_runs (campaign_id);
create index idx_agent_runs_company_id on public.agent_runs (company_id);
create index idx_agent_runs_status on public.agent_runs (status);

create index idx_suppressions_email on public.suppressions (email);
create index idx_suppressions_user_id on public.suppressions (user_id);
create index idx_suppressions_campaign_id on public.suppressions (campaign_id);
