import type { Page } from "@playwright/test";
import { E2E_TEST_EMAIL, E2E_TEST_PASSWORD } from "./global-setup";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_TEST_EMAIL);
  await page.getByLabel("Password").fill(E2E_TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}
