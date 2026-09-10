# Phase plan

Live checklist derived from `docs/spec.md` §32. Update this file as work lands — check items off, and add a short note (date + what shipped) rather than leaving it silently checked. Don't start a later phase's work ahead of an earlier phase unless there's a specific reason (note it if so).

**2026-09-10:** starting a backend-only build track (Trigger.dev workflow, no Next.js frontend yet — see `docs/spec.md`'s note under §24 and `CLAUDE.md`). This intentionally does the non-UI portions of Phases 1 and 3–7 first; the frontend-dependent items below stay unchecked until that separate session happens. Tracked as sub-phases B1–B8 in the corresponding plan.

## Phase 1 — Foundation
- [ ] Next.js + TypeScript project scaffolded *(deferred — frontend session)*
- [ ] Claude Frontend Design Skill applied to base UI shell (not a generic dashboard template — spec §1) *(deferred — frontend session)*
- [ ] Supabase project connected, Auth wired up
- [ ] Base schema + RLS policies (spec §8, §9)
- [x] `.env.example` created, matches `workflows/05-env-vars.md` — 2026-09-10, B1
- [x] Backend toolchain scaffolded: `package.json`, `tsconfig.json`, `trigger.config.ts`, eslint/vitest config, git repo initialized — 2026-09-10, B1
- [x] Trigger.dev `dev` and `deploy` verified working end-to-end (`hello-world` task deployed to `prod`) — 2026-09-10, B1

## Phase 2 — Campaigns
- [ ] Campaign creation form (name, industry, geography, company size, target roles, offer, value prop, CTA, optional instructions — spec §10)
- [ ] Campaign listing + detail views
- [ ] ICP configuration persisted per campaign

## Phase 3 — Lead Import
- [ ] CSV upload with validation preview (spec §11)
- [ ] URL normalization to canonical domain
- [ ] Duplicate detection, import stats (accepted/rejected/duplicate/invalid)
- [ ] Leads table

## Phase 4 — Research
- [ ] Secure URL fetcher with SSRF protection (spec §12, §23)
- [ ] Sitemap discovery + bounded crawler (default 15 pages/company)
- [ ] Website Research Agent producing the output contract in spec §13
- [ ] Evidence store (`ResearchSource`, `ResearchFinding`)

## Phase 5 — Decision Makers
- [ ] Provider abstraction for search/contact-data providers (spec §14)
- [ ] Public team/leadership page research
- [ ] Candidate ranking, confidence + source tracking
- [ ] Contact email status (verified/public/unverified/invalid/unknown)

## Phase 6 — Qualification
- [ ] Scoring engine with default weights (spec §15)
- [ ] Configurable weights in Settings
- [ ] Score/tier visualization in the leads table and lead detail view

## Phase 7 — Personalization & Email
- [ ] Personalization Agent (evidence-backed hook/observation/opportunity/value connection — spec §16)
- [ ] Email Generation Agent (subject/body/CTA/confidence — spec §17)
- [ ] Evidence linking (`EmailDraft.evidenceIds`) and Evidence drawer/modal (spec §18)
- [ ] Confidence threshold routes low-confidence drafts to `NEEDS_REVIEW`

## Phase 8 — Approval
- [ ] Approval queue: approve/reject/edit/regenerate (spec §19)
- [ ] Bulk approval, restricted to high-confidence records
- [ ] Approval/rejection timestamps and state history

## Phase 9 — Export
- [ ] Approved-only CSV export

## Phase 10 — Optional Sending
- [ ] `EmailProvider` interface + Resend implementation (spec §20)
- [ ] Sending disabled by default; explicit opt-in config
- [ ] Rate limits, retry handling, send logging
- [ ] Suppression/unsubscribe list enforced before every send

## Cross-cutting (ongoing through every phase)
- [ ] Zod validation on all agent I/O and API payloads
- [ ] Unit/integration/E2E tests per `04-testing.md`
- [ ] Mock mode (`MOCK_AI`/`MOCK_SEARCH`/`MOCK_EMAIL`) keeps working end-to-end
- [ ] Lint, typecheck, and build pass after each phase (spec §34)

## Definition of done (spec §33)

The full flow — Login → Create Campaign → Define ICP → Upload CSV → Start Processing → Research Companies → Find Decision Makers → Score Leads → Generate Personalized Emails → Inspect Evidence → Edit/Approve/Reject → Export Approved Leads — works end-to-end, builds cleanly, migrations apply cleanly, RLS is tested, mock mode runs the whole pipeline, and no core feature is an unimplemented placeholder.
