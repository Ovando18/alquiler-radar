import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPanel, type UsageSummary } from "./admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await requireAdmin())) redirect("/buscar");
  const db = createAdminClient();
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [users, logs, usage, cache] = await Promise.all([
    db.from("authorized_users").select("*").order("created_at", { ascending: false }).limit(200),
    db.from("webhook_logs").select("*").order("received_at", { ascending: false }).limit(100),
    db.from("scraping_usage").select("provider, portal, success, created_at").gte("created_at", since30).limit(20000),
    db.from("search_cache").select("cache_key", { count: "exact", head: true }).gt("expires_at", new Date().toISOString()),
  ]);

  const since24 = Date.now() - 86_400_000;
  const summary: UsageSummary = { total30d: 0, total24h: 0, failures30d: 0, byProvider: {}, byPortal: {}, cacheEntries: cache.count ?? 0 };
  for (const u of usage.data ?? []) {
    if (u.provider === "cache") continue; // cache hit não consome crédito
    summary.total30d++;
    if (new Date(u.created_at).getTime() > since24) summary.total24h++;
    if (!u.success) summary.failures30d++;
    summary.byProvider[u.provider] = (summary.byProvider[u.provider] ?? 0) + 1;
    const p = (summary.byPortal[u.portal] ??= { ok: 0, fail: 0 });
    u.success ? p.ok++ : p.fail++;
  }
  const cacheHits = (usage.data ?? []).filter((u) => u.provider === "cache").length;

  return <AdminPanel initialUsers={users.data ?? []} logs={logs.data ?? []} usage={{ ...summary, cacheHits30d: cacheHits }} />;
}
