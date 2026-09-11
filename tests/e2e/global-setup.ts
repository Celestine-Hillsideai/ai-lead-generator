import { getSupabaseServiceClient } from "../../lib/database/client";

/**
 * Ensures a confirmed test user exists before any E2E test runs, using the
 * admin API (like tools/seed-mock-data.ts) -- a plain signUp() through the
 * UI wouldn't reliably produce a logged-in session if this Supabase
 * project has email confirmation enabled (unknown/unverified here), so
 * E2E auth is done against a pre-confirmed account rather than exercising
 * live signup.
 */
export const E2E_TEST_EMAIL = "e2e-test@example.com";
export const E2E_TEST_PASSWORD = "E2E-test-password-123!";

export default async function globalSetup() {
  const db = getSupabaseServiceClient();
  const { data: existing, error: listError } = await db.auth.admin.listUsers();
  if (listError) throw new Error(`E2E global setup: failed to list users: ${listError.message}`);

  const user = existing.users.find((u) => u.email === E2E_TEST_EMAIL);

  if (user) {
    const { error } = await db.auth.admin.updateUserById(user.id, {
      password: E2E_TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`E2E global setup: failed to update test user: ${error.message}`);
  } else {
    const { error } = await db.auth.admin.createUser({
      email: E2E_TEST_EMAIL,
      password: E2E_TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`E2E global setup: failed to create test user: ${error.message}`);
  }
}
