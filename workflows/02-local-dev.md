# Local development

## Prerequisites

- Node.js (LTS) and a package manager (npm/pnpm — pick one when Phase 1 scaffolds the app, and use it consistently).
- A Supabase project (or the Supabase local dev stack via `supabase start`, if used) for a real database to develop against.
- Trigger.dev CLI (`npx trigger.dev@latest dev`) for running tasks locally against the Trigger.dev dev environment.

## First-time setup

1. Copy `.env.example` to `.env.local`, or run `tools/setup-env.ps1` to scaffold it and check required vars are present.
2. Fill in Supabase URL/keys at minimum. Leave `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `SEARCH_API_KEY` / `RESEND_API_KEY` blank and use mock mode (below) until real integrations are needed.
3. Run migrations against your dev Supabase project: `tools/supabase-migrate.ps1`.

## Running the app locally

- Frontend/API: standard Next.js dev server (`npm run dev` once scaffolded).
- Backend pipeline: `npx trigger.dev@latest dev` in a separate terminal — this runs your `trigger/` tasks locally and connects them to your Trigger.dev dev environment, so triggering a run from the local Next.js app executes real task code on your machine.
- Both processes talk to the same Supabase project, so you see live status updates in the local UI exactly as in production (spec §21, §26).

## Mock mode (spec §29)

Set in `.env.local`:

```
MOCK_AI=true
MOCK_SEARCH=true
MOCK_EMAIL=true
```

With these set, the research/decision-maker/qualification/personalization/email agents use deterministic mock providers instead of calling Anthropic/OpenAI, search/contact-data APIs, or Resend. Use this for day-to-day development and for all automated tests — never hit paid external APIs from tests. `tools/seed-mock-data.ts` seeds representative companies/leads to exercise the full pipeline in this mode.

## Common tasks

- Seed mock data: `tools/seed-mock-data.ts` (once `lib/database` exists to run it against).
- Validate a CSV against the lead-import contract without going through the UI: `tools/validate-csv.ts <path>`.
- Apply a new migration: `tools/supabase-migrate.ps1`.
