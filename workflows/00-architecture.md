# Architecture

How the pieces fit together and, specifically, how the Vercel-hosted frontend and the Trigger.dev-hosted backend communicate. Read this before touching deployment config, the Trigger.dev SDK integration, or Supabase Realtime wiring.

## Components

| Component | Runs where | Responsibility |
|---|---|---|
| Next.js app (`app/`, `components/`) | **Vercel** | UI, auth, campaign/lead CRUD, kicking off pipeline runs, reading results |
| API routes / server actions | **Vercel** (part of the Next.js app) | Validated entry points; the only place `TRIGGER_SECRET_KEY` is used to call `task.trigger()` |
| Agent logic (`agents/`) + prompts (`prompts/`) | **Trigger.dev** (imported by tasks) | Research, decision-maker discovery, qualification, personalization, email generation |
| Task orchestration (`trigger/`) | **Trigger.dev** | `campaign-workflow.ts`, `research-workflow.ts` — the retryable, per-company pipeline; `sourcing-workflow.ts` — automated ICP-driven company discovery (spec §11A), writing `sourcing_runs` + `companies` the same way the others write their tables |
| Database (Postgres + Auth + RLS + Realtime) | **Supabase** | Single source of truth for both sides; also the communication channel |

## Why two deploy targets instead of one

Vercel serverless functions have execution time limits unsuitable for a multi-page crawl + multiple LLM calls per company, repeated across many companies in a campaign. Trigger.dev is built for exactly this: long-running, retryable, per-item-isolated background jobs. Keeping them separate means the pipeline's reliability model (retries, pause/resume/cancel, per-company failure isolation — spec §21) doesn't have to fight Vercel's request/response lifecycle.

## How Vercel and Trigger.dev communicate

There is no direct HTTP contract between the two — they don't call each other's APIs for data. Instead:

1. **Trigger (Vercel → Trigger.dev):** A server action or API route (e.g. `POST /api/campaigns/:id/process`) calls the Trigger.dev SDK:
   ```ts
   import { tasks } from "@trigger.dev/sdk";
   await tasks.trigger("campaign-workflow", { campaignId });
   ```
   This requires `TRIGGER_SECRET_KEY`, set only in Vercel's server environment. This is the only outbound call from Vercel to Trigger.dev.

2. **Write (Trigger.dev → Supabase):** The task, running on Trigger.dev's infra, does all its work (crawling, calling the AI provider, scoring, drafting) and writes results directly to Supabase using `SUPABASE_SERVICE_ROLE_KEY`, set only in Trigger.dev's environment. It updates the `Company`/`Contact`/`Qualification`/`EmailDraft` rows and advances the status columns defined in spec §26 as each stage completes.

3. **Read (Supabase → Vercel/browser):** The frontend does **not** poll Trigger.dev for run status. It subscribes to Supabase Realtime on the relevant tables/rows (e.g. `Company.researchStatus`, `Campaign.status`) so the UI updates live as the backend writes progress. For a one-off fetch (e.g. initial page load), it queries Supabase directly through the typed Supabase client, respecting RLS.

This means: **Supabase is the API.** Vercel and Trigger.dev are two independent clients of the same database, each holding only the credentials it needs (anon/service-role split), never proxying data through each other.

## Repo/deploy topology

- One GitHub repository.
- Vercel's GitHub integration builds and deploys the Next.js app on every push to `main` (plus PR previews).
- Trigger.dev deploys are separate — triggered manually via `tools/deploy-trigger.ps1` or automated with a GitHub Action (see `01-deployment.md`). A push to `main` does not automatically redeploy Trigger.dev tasks unless that Action is wired up.
- Both deploys read from the same `trigger/`, `agents/`, `prompts/`, `lib/`, `types/` source — no code duplication between "frontend" and "backend" because there is only one codebase.

## Naming: the two "workflows" folders

See `CLAUDE.md` for the full explanation. Short version: repo-root `workflows/` = this playbook folder (agent instructions, W in WAT). `trigger/` (inside the app, once scaffolded) = Trigger.dev task definitions. They are not the same thing and nothing should live in both.
