import { test, expect } from "@playwright/test";
import { login } from "./helpers";

/**
 * Golden path per docs/spec.md §30/§33: Login -> Create Campaign -> Upload
 * CSV -> Process -> Review Lead -> Approve -> Export.
 *
 * Scope note: this covers Login through triggering processing and confirms
 * the UI reflects it. It stops short of Review/Approve/Export because those
 * require the pipeline to actually finish a run (reach EMAIL_READY), which
 * needs a live `trigger.dev dev` worker connected to the same Trigger.dev
 * project -- this config doesn't spin one up. See tests/e2e/README.md for
 * how to exercise the rest manually (or extend this suite) once one's
 * running alongside `npm run test:e2e`.
 */

test("create a campaign, import leads via CSV, and start processing", async ({ page }) => {
  await login(page);

  const campaignName = `E2E Test Campaign ${Date.now()}`;

  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign name").fill(campaignName);
  await page.getByLabel("Industry").fill("Logistics");
  await page.getByLabel("Target geography").fill("West Africa");
  await page.getByLabel("Target roles (comma-separated)").fill("CEO, COO");
  await page.getByLabel("What are you offering?").fill("Real-time freight visibility platform");
  await page.getByLabel("Value proposition").fill("Cut manual tracking overhead during expansion");
  await page.getByLabel("Desired call to action").fill("Book a 15-minute call");
  await page.getByRole("button", { name: "Create campaign" }).click();

  await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: campaignName })).toBeVisible();

  // Import leads via CSV (spec §11) -- real, stable, crawlable domains, not
  // invented "*.example.com" subdomains (see tools/seed-mock-data.ts's own
  // note on why those don't resolve).
  const csv = "company_name,website,industry\nIANA,https://www.iana.org,Internet Infrastructure\n";
  await page.setInputFiles('input[name="file"]', {
    name: "leads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Import" }).click();

  // The import success message lives inside the CsvImport component, which
  // the campaign detail page only renders while companies.length === 0 --
  // a successful import triggers revalidatePath and the page re-renders
  // without it almost immediately, so asserting on that message directly is
  // racy. "View leads (1)" appearing is the stable, equivalent signal that
  // the one row from the CSV was actually persisted.
  await expect(page.getByRole("link", { name: "View leads (1)" })).toBeVisible({ timeout: 10_000 });

  // Start processing -- this really calls tasks.trigger() against the
  // configured Trigger.dev project (see lib/supabase/server.ts's caller,
  // app/actions/campaigns.ts). It queues a real run; without a connected
  // dev worker it just sits queued, which is fine for what this test checks.
  await page.getByRole("button", { name: "Start processing" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible({ timeout: 10_000 });
});

test("settings can be edited and saved", async ({ page }) => {
  await login(page);
  await page.goto("/settings");

  await page.getByLabel("Industry fit").fill("0.3");
  await page.getByLabel("Company size").fill("0.1");
  await page.getByLabel("Geographic fit").fill("0.1");
  await page.getByLabel("Problem/opportunity").fill("0.25");
  await page.getByLabel("Decision-maker fit").fill("0.15");
  await page.getByLabel("Buying signal").fill("0.1");

  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved.")).toBeVisible({ timeout: 10_000 });
});

test("approvals queue loads without error", async ({ page }) => {
  await login(page);
  await page.goto("/approvals");
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
});
