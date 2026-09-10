# Deployment

Two independent deploy targets from one GitHub repo: **Vercel** (frontend/API) and **Trigger.dev** (backend pipeline). See `00-architecture.md` for why they're split and how they communicate.

## One-time setup

1. **GitHub:** push this repo to a GitHub repository (not yet done — this project has no git remote as of the WAT scaffold being written).
2. **Vercel:**
   - Import the GitHub repo as a new Vercel project.
   - Set the Vercel-side env vars (see `05-env-vars.md` for the exact list) in Project Settings → Environment Variables, for Production and Preview.
   - Framework preset: Next.js (auto-detected).
3. **Trigger.dev:**
   - Create a Trigger.dev project in the dashboard (not via `npx trigger.dev@latest init` — this repo uses manual setup: `trigger.config.ts` and `package.json` are hand-authored so the exact `@trigger.dev/sdk`/`@trigger.dev/build` versions stay pinned to the CLI version, which the CLI enforces at deploy time). Paste the project's ref (`proj_...`) into `trigger.config.ts`.
   - Run `npx trigger.dev@latest login` once, locally, interactively — this can't be scripted.
   - Set the Trigger.dev-side env vars (see `05-env-vars.md`) in the Trigger.dev dashboard's environment variables, for both `dev` and `prod`/`deployed` environments.
4. **Supabase:**
   - Create the Supabase project, apply migrations (`tools/supabase-migrate.ps1`), enable RLS per `docs/spec.md` §9.
   - Copy the project URL + anon key + service role key into both Vercel's and Trigger.dev's env var stores as appropriate (see `05-env-vars.md` — they don't get the same keys).

## Ongoing deploys

- **Frontend (Vercel):** automatic. Push to `main` → Vercel builds and deploys. Pushing a branch/PR → Vercel preview deploy.
- **Backend (Trigger.dev):** manual by default — run `tools/deploy-trigger.ps1` (wraps `trigger.dev deploy`, pinned to the exact CLI version matching `@trigger.dev/sdk` in `package.json`) after changes to `trigger/`, `agents/`, or `prompts/`. To automate, add a GitHub Action that runs the same command on push to `main`, gated to only fire when those paths change (avoids redeploying tasks for pure frontend commits).

### Known issue: Windows paths with spaces

Trigger.dev's deploy indexer has a bug on Windows when the project lives at a path containing a space (this repo's Desktop folder does): it internally produces a URL-encoded path (`AI%20LEAD%20GENERATOR`) and then fails to resolve `trigger.config.mjs` from that literal encoded path — `Cannot find module '/app/.../trigger.config.mjs'`. A directory junction does **not** work around this; Windows silently resolves it back to the real path.

`tools/deploy-trigger.ps1` works around this automatically: it `robocopy`s the project (excluding `node_modules`, `.git`, `.trigger`, `.env*`) to a space-free staging directory under `%LOCALAPPDATA%\trigger-deploy-staging\`, runs `npm install` there, and deploys from that copy. No action needed — just always deploy via this script rather than calling `trigger.dev deploy` directly while the repo lives under a spaced path.

## Order of operations for a schema change

Supabase migrations affect both sides. When changing the schema:

1. Write and apply the migration (`tools/supabase-migrate.ps1`).
2. Update shared `types/` to match.
3. Deploy Trigger.dev tasks first (`tools/deploy-trigger.ps1`) so the pipeline writes the new shape.
4. Then let/push the Vercel deploy so the frontend reads the new shape.

Reversing this order risks the frontend querying columns the Trigger.dev pipeline hasn't started populating yet, or vice versa.

## Rollback

- **Vercel:** use the dashboard to promote a previous deployment back to Production instantly.
- **Trigger.dev:** redeploy the previous git commit's `trigger/` code with `tools/deploy-trigger.ps1`; Trigger.dev keeps prior deployed versions but new runs pick up the latest deploy by default, so rollback means re-deploying old source, not toggling a version flag.
- **Supabase migrations:** write a corresponding down-migration; do not hand-edit production schema.
