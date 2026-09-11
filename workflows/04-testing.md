# Testing

Per `docs/spec.md` §30. Stack: Vitest (unit/integration), React Testing Library (components), Playwright (E2E).

## Layers

- **Unit tests:** URL normalization, CSV parsing, ICP scoring math, Zod validation schemas, SSRF protection (reject localhost/private/link-local targets), deduplication logic. These are pure-function tests — no network, no DB.
- **Agent contract tests:** each agent in `agents/` tested against mocked provider responses (`MOCK_AI=true` etc.) — verify the agent produces schema-valid output for representative inputs, and handles malformed model output via the repair/retry path (spec §22).
- **Integration tests:** research → qualification → personalization → email generation, chained together with mock providers, against a real (test) Supabase instance to catch schema/RLS mismatches.
- **End-to-end (Playwright):** `tests/e2e/`, runs against a **production build** (`next build` + `next start`), not `next dev` — dev mode's on-demand per-route compilation caused severe flakiness on a slow machine (concurrent navigations across routes triggered simultaneous recompiles). Currently covers Login → Create Campaign → Upload CSV → Start Processing, plus Settings editing and the Approvals page loading; see `tests/e2e/README.md` for why Review/Approve/Export aren't covered yet (needs a live `trigger.dev dev` worker) and how to extend it once one's running.
- **Permission isolation tests:** verify RLS actually prevents user A from reading/writing user B's campaigns/companies/contacts/emails. Not yet written as an automated test — todo.

## Rules

- Automated tests use mock providers (`MOCK_AI`, `MOCK_SEARCH`, `MOCK_EMAIL`) — never call live Anthropic/OpenAI/search/Resend APIs from a test run.
- Every agent output schema gets at least one test that feeds it a deliberately malformed model response and asserts the repair/retry path is exercised, not just the happy path.
- Test error and retry states explicitly (a company whose website fetch fails; an agent run that fails N times and gets marked `FAILED` without blocking the rest of the campaign — spec §21).

## Running

After each phase in `03-phase-plan.md`, run, in order: lint → typecheck → unit tests → integration tests → production build. Don't mark a phase's checklist items done until all of these pass.

Exact commands get filled in once `package.json` exists in Phase 1 (e.g. `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build`) — update this section then instead of guessing at commands here.
