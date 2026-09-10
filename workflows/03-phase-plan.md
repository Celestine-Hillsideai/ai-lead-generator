# Phase plan

Live checklist derived from `docs/spec.md` §32. Update this file as work lands — check items off, and add a short note (date + what shipped) rather than leaving it silently checked. Don't start a later phase's work ahead of an earlier phase unless there's a specific reason (note it if so).

**2026-09-10:** starting a backend-only build track (Trigger.dev workflow, no Next.js frontend yet — see `docs/spec.md`'s note under §24 and `CLAUDE.md`). This intentionally does the non-UI portions of Phases 1 and 3–7 first; the frontend-dependent items below stay unchecked until that separate session happens. Tracked as sub-phases B1–B8 in the corresponding plan.

## Phase 1 — Foundation
- [ ] Next.js + TypeScript project scaffolded *(deferred — frontend session)*
- [ ] Claude Frontend Design Skill applied to base UI shell (not a generic dashboard template — spec §1) *(deferred — frontend session)*
- [ ] Supabase project connected, Auth wired up *(migrations written, awaiting `supabase link` + `db push` with live credentials)*
- [x] Base schema + RLS policies (spec §8, §9) — 2026-09-10, B2 (migrations in `supabase/migrations/`, not yet applied to a live project)
- [x] `.env.example` created, matches `workflows/05-env-vars.md` — 2026-09-10, B1
- [x] Backend toolchain scaffolded: `package.json`, `tsconfig.json`, `trigger.config.ts`, eslint/vitest config, git repo initialized — 2026-09-10, B1
- [x] Trigger.dev `dev` and `deploy` verified working end-to-end (`hello-world` task deployed to `prod`) — 2026-09-10, B1

## Phase 2 — Campaigns
- [ ] Campaign creation form (name, industry, geography, company size, target roles, offer, value prop, CTA, optional instructions — spec §10)
- [ ] Campaign listing + detail views
- [ ] ICP configuration persisted per campaign

## Phase 3 — Lead Import
- [x] CSV upload with validation preview (spec §11) — 2026-09-10, B5 (`lib/validation/csv.ts`; upload UI is a frontend-session item, validation logic itself is done)
- [x] URL normalization to canonical domain — 2026-09-10, B5
- [x] Duplicate detection, import stats (accepted/rejected/duplicate/invalid) — 2026-09-10, B5
- [ ] Leads table *(frontend session)*

## Phase 4 — Research
- [x] Secure URL fetcher with SSRF protection (spec §12, §23) — 2026-09-10, B4 (`lib/security/ssrf.ts`, `lib/scraper/fetcher.ts`; known residual DNS-rebinding gap noted in code comments)
- [x] Sitemap discovery + bounded crawler (default 15 pages/company) — 2026-09-10, B4 (`lib/scraper/{sitemap,crawler,robots,extract}.ts`, 13 passing tests against a local test server)
- [x] Website Research Agent producing the output contract in spec §13 — 2026-09-10, B6 (`agents/research-agent.ts`, `prompts/research.prompt.ts`)
- [ ] Evidence store (`ResearchSource`, `ResearchFinding`) *(schema exists from B2; population happens in B7 orchestration)*

## Phase 5 — Decision Makers
- [x] Provider abstraction for search/contact-data providers (spec §14) — 2026-09-10, B5 (`lib/search/`, mock only, no real provider selected)
- [x] Public team/leadership page research — 2026-09-10, B6 (`agents/decision-maker-agent.ts` takes crawled pages + optional SearchProvider results)
- [x] Candidate ranking, confidence + source tracking — 2026-09-10, B6 (role-priority instruction in `prompts/decision-maker.prompt.ts`)
- [x] Contact email status (verified/public/unverified/invalid/unknown) — modeled in `types/status.ts` + `lib/search/types.ts`, 2026-09-10, B5

## Phase 6 — Qualification
- [x] Scoring engine with default weights (spec §15) — 2026-09-10, B6 (`agents/qualification-agent.ts`; overall score/tier recomputed deterministically from the model's sub-scores rather than trusting model arithmetic)
- [x] Configurable weights in Settings — weights are a parameter to `runQualificationAgent`, 2026-09-10, B6 (Settings *UI* is a frontend-session item)
- [ ] Score/tier visualization in the leads table and lead detail view *(frontend session)*

## Phase 7 — Personalization & Email
- [x] Personalization Agent (evidence-backed hook/observation/opportunity/value connection — spec §16) — 2026-09-10, B6 (`agents/personalization-agent.ts`; hallucinated evidenceIds are rejected via a per-call schema refinement, not just prompt instruction)
- [x] Email Generation Agent (subject/body/CTA/confidence — spec §17) — 2026-09-10, B6 (`agents/email-agent.ts`; evidenceIds checked against the personalization material's own evidence)
- [x] Evidence linking (`EmailDraft.evidenceIds`) — 2026-09-10, B6 (structural, not just DB column); Evidence drawer/modal *(frontend session)*
- [x] Confidence threshold routes low-confidence drafts to `NEEDS_REVIEW` — 2026-09-10, B6 (`agents/email-agent.ts`'s `needsReview()`; actually setting `Company.researchStatus`/`EmailDraft.status` happens in B7 orchestration)

## Phase 8 — Approval
- [ ] Approval queue: approve/reject/edit/regenerate (spec §19)
- [ ] Bulk approval, restricted to high-confidence records
- [ ] Approval/rejection timestamps and state history

## Phase 9 — Export
- [ ] Approved-only CSV export

## Phase 10 — Optional Sending
- [x] `EmailProvider` interface + Resend implementation (spec §20) — 2026-09-10, B5 (`lib/email/`)
- [x] Sending disabled by default; explicit opt-in config — 2026-09-10, B5 (MOCK_EMAIL must be explicitly "false" to use Resend)
- [ ] Rate limits, retry handling, send logging *(orchestration-level, later)*
- [ ] Suppression/unsubscribe list enforced before every send *(orchestration-level, later)*

## Orchestration (spec §21) — not a numbered phase in the original spec, sits under Phase 4-7
- [x] `trigger/research-workflow.ts`: per-company pipeline (research → decision-maker → qualification → personalization → email), status transition to Supabase after every stage, per-company try/catch → FAILED on error — 2026-09-10, B7
- [x] `trigger/campaign-workflow.ts`: fan-out via `batchTriggerAndWait`, chunked (default 20) for pause-checkpointing, idempotency keys per company, respects `MAX_COMPANIES_PER_CAMPAIGN`, resume is idempotent (only non-terminal-status companies re-triggered) — 2026-09-10, B7
- [x] `lib/database/repository.ts` + `supabase-repository.ts`: DB access behind an interface so orchestration logic is unit-testable without a live Supabase project — 2026-09-10, B7
- [x] `scripts/trigger-campaign.ts`: CLI harness to fire a campaign run without a frontend — 2026-09-10, B7
- [x] Full mock-mode pipeline verified end-to-end in-process (reaches `EMAIL_READY`/`NEEDS_REVIEW`, per-page and per-company failure isolation, chunking/pause/resume) — 2026-09-10, B7, 10 new tests; **not yet verified against a live Supabase + deployed Trigger.dev environment** (blocked on Supabase linking, see B2's note)

## Cross-cutting (ongoing through every phase)
- [x] Zod validation on all agent I/O and API payloads — 2026-09-10, B3 (`types/contracts/*`, 20 passing round-trip tests in `tests/unit/contracts.test.ts`)
- [x] Unit/integration/E2E tests per `04-testing.md` — 92 passing tests as of B7 (unit + integration; no E2E yet, that needs the frontend)
- [x] Mock mode (`MOCK_AI`/`MOCK_SEARCH`/`MOCK_EMAIL`) keeps working end-to-end — verified in-process via `tests/unit/research-workflow.test.ts`; live Trigger.dev dev-mode run still pending Supabase linking
- [x] Lint, typecheck, and build pass after each phase (spec §34) — maintained through B1-B7; Trigger.dev dry-run build also verified after B7

## Definition of done (spec §33)

The full flow — Login → Create Campaign → Define ICP → Upload CSV → Start Processing → Research Companies → Find Decision Makers → Score Leads → Generate Personalized Emails → Inspect Evidence → Edit/Approve/Reject → Export Approved Leads — works end-to-end, builds cleanly, migrations apply cleanly, RLS is tested, mock mode runs the whole pipeline, and no core feature is an unimplemented placeholder.
