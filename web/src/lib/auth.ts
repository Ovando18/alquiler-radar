import "server-only";
import { createClient } from "@/lib/supabase/server";
import { decideAccess, type AccessRow } from "@/lib/access";

/** Verificação server-side (defesa em profundidade além do middleware). */
export async function getAccess() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { user: null, decision: { ok: false as const, reason: "not_found" as const }, supabase };
  const { data: row } = await supabase
    .from("authorized_users")
    .select("status, role, data_expiracao")
    .eq("email", user.email.toLowerCase())
    .maybeSingle<AccessRow>();
  return { user, decision: decideAccess(row), supabase };
}

export async function requireAdmin() {
  const a = await getAccess();
  if (!a.user || !a.decision.ok || !a.decision.admin) return null;
  return a.user;
}
