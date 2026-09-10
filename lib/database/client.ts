import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";

/**
 * Service-role Supabase client for use inside Trigger.dev tasks. Bypasses
 * RLS entirely -- that's expected here (the pipeline is the trusted backend
 * writer), not a bug. Never import this from anything that could run in a
 * browser context.
 *
 * A future Next.js app builds its own anon-key client separately (out of
 * scope for this backend-only build).
 */
export function getSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env.local and fill them in."
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
