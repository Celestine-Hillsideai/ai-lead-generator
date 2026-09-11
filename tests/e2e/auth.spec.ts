import { test, expect } from "@playwright/test";
import { E2E_TEST_EMAIL } from "./global-setup";
import { login } from "./helpers";

test("redirects an unauthenticated visitor to /login", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/login**");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("shows an error for invalid credentials without navigating away", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_TEST_EMAIL);
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText(/invalid|error/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("logs in with valid credentials and reaches the dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});

test("signing out redirects back to /login", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/login**");
});
