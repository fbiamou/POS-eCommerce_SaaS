import { createClient } from "@supabase/supabase-js";

// Server-only client using the service_role key — bypasses RLS entirely.
// Never import this from client-side code or Server Components that could
// leak it; only from trusted server contexts like the cron route handler.
export function createServiceRoleClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY n'est pas configurée.");
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
