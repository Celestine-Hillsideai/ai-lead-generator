# Deployment

Two independent deploy targets from one GitHub repo: **Vercel** (frontend/API) and **Trigger.dev** (backend pipeline). See `00-architecture.md` for why they're split and how they communicate.

**Live as of 2026-09-11:**
- GitHub: [github.com/Celestine-Hillsideai/ai-lead-generator](https://github.com/Celestine-Hillsideai/ai-lead-generator) (private)
- Vercel: `hillsideai/ai-lead-generator`, production at https://ai-lead-generator-hillsideai.vercel.app
- Trigger.dev: project `ai-lead-generator` (`proj_lnazyzacybswreyturun`), `research-workflow` + `campaign-workflow` deployed to `prod`

## One-time setup

1. **GitHub:** `gh repo create <name> --private --source=. --remote=origin --push` (or push to an existing repo). Note: `gh`/`git` calls to `api.github.com` can hit this sandbox's network restrictions — if a push/repo-create hangs or errors with a connectivity message, retry with the sandbox disabled for that one command.
2. **Vercel:**
   - `vercel link --yes --project <name>` from the repo root — auto-detects Next.js and connects the GitHub repo. (The directory-name-derived default project name will fail if it contains spaces/uppercase — pass `--project` explicitly.)
   - Set env vars per `05-env-vars.md` via `vercel env add <NAME> production` (add `--type config` for values that are meant to be public, like `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Vercel will refuse credential-shaped `NEXT_PUBLIC_` values otherwise and tell you which flag to use).
   - **Deployment Protection:** Vercel's own "Vercel Authentication" (SSO) is on by default for new projects and will block all access — including real end users — behind a Vercel login, on top of the app's own Supabase Auth. Disable it for a publicly-reachable app: `vercel project protection disable <name> --sso`.
   - First deploy: pushing to `main` (or `git commit --allow-empty` + push if nothing changed) triggers it via the GitHub integration. `vercel --prod` (direct CLI upload) is less reliable on a flaky connection — prefer the GitHub-triggered path if the CLI upload fails with a generic `fetch failed`.
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
