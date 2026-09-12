# Environment variables

Base list from `docs/spec.md` §31, split by which deploy target actually needs each one. Keep `.env.example` (once Phase 1 creates it) in sync with this table — this file is the explanation, `.env.example` is the checked-in template.

| Variable | Vercel | Trigger.dev | Notes |
|---|:---:|:---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | Public; safe in both. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | — | Public/browser-safe key; frontend reads through RLS with this. |
| `SUPABASE_SERVICE_ROLE_KEY` | — | ✅ | **Not set on Vercel as built.** Every Server Action/Route Handler in `app/` uses `lib/supabase/server.ts` (anon key + the user's session cookie, RLS-scoped) — there are no privileged writes that bypass RLS from the frontend. Only Trigger.dev tasks use the service-role client (`lib/database/client.ts`). If a future Vercel-side operation genuinely needs to bypass RLS, add this var then, server-only, and re-justify it rather than adding it by default. |
| `ANTHROPIC_API_KEY` | — | ✅ | Agents run in `trigger/` tasks, not in Vercel functions. Only set where the agents actually execute. |
| `OPENAI_API_KEY` | — | ✅ | Same as above — only if OpenAI is the selected provider. |
| `SEARCH_API_KEY` | — | ✅ | Used by the Decision-Maker Research Agent, which runs in a Trigger.dev task. |
| `SOURCING_API_KEY` | — | ✅ | Used by the company-sourcing provider (spec §11A, `lib/sourcing/`), which runs in `trigger/sourcing-workflow.ts`. Deliberately a separate key/concern from `SEARCH_API_KEY` — company-level ICP discovery vs. person-level lookup within an already-known company. |
| `RESEND_API_KEY` | — | ✅ | Sending happens from the Trigger.dev pipeline (Phase 10), not from a Vercel request. |
| `NEXT_PUBLIC_APP_URL` | ✅ | — | Used for building links back to the app (e.g. in emails); frontend concern. |
| `MOCK_AI` / `MOCK_SEARCH` / `MOCK_SOURCING` / `MOCK_EMAIL` | — | ✅ | Only relevant where the agents run. |
| `MAX_COMPANIES_PER_SOURCING_RUN` | — | ✅ | Cost control (spec §28) for automated sourcing, same treatment as `MAX_COMPANIES_PER_CAMPAIGN`/`MAX_PAGES_PER_COMPANY`. |
| `TRIGGER_SECRET_KEY` | ✅ (server-only) | — | Vercel uses this to call `tasks.trigger(...)` and start a pipeline run. Not an app-spec var — added for this repo's Vercel↔Trigger.dev integration; see `00-architecture.md`. |
| `TRIGGER_API_URL` | ✅ (server-only) | — | Only needed if self-hosting Trigger.dev or pointing at a non-default API URL; omit if using Trigger.dev Cloud defaults. |

## Rules

- Never put `SUPABASE_SERVICE_ROLE_KEY`, any AI provider key, `SEARCH_API_KEY`, `SOURCING_API_KEY`, `RESEND_API_KEY`, or `TRIGGER_SECRET_KEY` behind a `NEXT_PUBLIC_` prefix or otherwise ship them to the browser.
- Vercel and Trigger.dev have separate environment variable stores (Vercel Project Settings vs the Trigger.dev dashboard) — setting a var in one does not set it in the other. When adding a new secret, decide which side actually needs it (default to "only where the code that uses it runs") and set it there, per the table above.
- Keep `MOCK_EMAIL=true` as the default even outside local dev until Phase 10 is deliberately enabling real sends — sending must stay opt-in (spec §20).
- A `NEXT_PUBLIC_` var whose value looks like a credential gets refused by `vercel env add` unless you pass `--type config` (public, e.g. the Supabase anon key) or `--type secret` with a non-public name — see `01-deployment.md`.
- New Vercel projects have "Vercel Authentication" (SSO) deployment protection on by default, which blocks everyone (including real end users) behind a Vercel login on top of the app's own auth. Disable with `vercel project protection disable <name> --sso` for a publicly-reachable app.
