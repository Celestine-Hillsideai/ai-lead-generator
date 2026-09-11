import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../database/types.generated";

/**
 * Supabase client for Server Components / Server Actions / Route Handlers.
 * Uses the anon key + the user's session cookie, so every query runs as the
 * authenticated user and is subject to RLS (supabase/migrations/*_rls_policies.sql)
 * -- this is intentionally NOT the service-role client (lib/database/client.ts),
 * which only Trigger.dev tasks should use.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component (not a Server Action/Route Handler) --
            // cookies can't be set here. Harmless as long as middleware.ts is
            // also refreshing the session, which it is.
          }
        },
      },
    }
  );
}
