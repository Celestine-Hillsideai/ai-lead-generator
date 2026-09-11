# E2E tests

Playwright, per `docs/spec.md` §30. Run with:

```
npx playwright install chromium   # one-time, downloads the browser binary
set -a; source .env.local; set +a  # loads SUPABASE_SERVICE_ROLE_KEY etc. for global-setup.ts
npm run test:e2e
```

`tests/e2e/global-setup.ts` creates (or resets the password of) a confirmed
test user via the Supabase admin API before any test runs — a plain sign-up
through the UI isn't used for auth setup because this project's Supabase
instance may or may not have email confirmation enabled, and a real signup
wouldn't reliably produce a logged-in session either way.

## Scope

`golden-path.spec.ts` covers Login → Create Campaign → Upload CSV → Start
Processing, and confirms the UI reflects each step. It does **not** cover
Review Lead → Approve → Export, because those require a campaign run to
actually finish (reach `EMAIL_READY`), which needs a live `trigger.dev dev`
worker connected to the same Trigger.dev project — `playwright.config.ts`'s
`webServer` only starts `next dev`, not a Trigger.dev worker.

To exercise the rest manually: run `npx trigger.dev@latest dev` in a
separate terminal (same project, see `workflows/02-local-dev.md`), then run
the golden-path test — the "Start processing" step will actually complete
end-to-end against your local worker, and you can extend the test (or test
by hand in a browser) to cover the review/approve/export steps once the
company reaches `EMAIL_READY`.
