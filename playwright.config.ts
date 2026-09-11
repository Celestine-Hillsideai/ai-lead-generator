import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config, per docs/spec.md §30. Runs against a production
 * build (`next build` + `next start`), not `next dev` -- dev mode's
 * on-demand-per-route compilation caused severe flakiness/timeouts on a
 * slow CI-like machine (concurrent Playwright navigations across several
 * routes triggered simultaneous recompiles, occasionally producing a
 * "SyntaxError: Unexpected end of JSON input" from a request racing an
 * in-flight compile). Uses MOCK_AI/MOCK_SEARCH/MOCK_EMAIL (from .env.local)
 * so these tests never hit paid external APIs -- see workflows/04-testing.md.
 *
 * Scope: the golden path up through triggering a campaign. Verifying the
 * pipeline actually *completes* (reaches EMAIL_READY) would additionally
 * require a live `trigger.dev dev` worker running alongside this test run,
 * which this config does not orchestrate -- see tests/e2e/README.md.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
