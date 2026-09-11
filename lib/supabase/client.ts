import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database/types.generated";

/** Supabase client for Client Components (browser). Anon key, RLS-scoped, session from cookies. */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
