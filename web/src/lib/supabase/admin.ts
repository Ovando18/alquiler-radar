import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/** Cliente service_role — ignora RLS. NUNCA importar em código client-side. */
export function createAdminClient() {
  return createClient(serverEnv.supabaseUrl(), serverEnv.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
