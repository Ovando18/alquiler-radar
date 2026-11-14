"use client";
import { useState } from "react";
import { Ban, Loader2, Plus, RefreshCw, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { cn, fmtDate } from "@/lib/utils";
import { portalLabel } from "@/lib/types";

type User = Record<string, any>;
type Log = Record<string, any>;
export type UsageSummary = {
  total30d: number;
  total24h: number;
  failures30d: number;
  byProvider: Record<string, number>;
  byPortal: Record<string, { ok: number; fail: number }>;
  cacheEntries: number;
  cacheHits30d?: number;
};

const TABS = [
  { id: "users", label: "Assinantes" },
  { id: "logs", label: "Webhooks Hotmart" },
  { id: "usage", label: "Uso de scraping" },
] as const;

export function AdminPanel({ initialUsers, logs, usage }: { initialUsers: User[]; logs: Log[]; usage: UsageSummary }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("users");
  const active = initialUsers.filter((u) => u.status === "ativo" && (u.role === "admin" || new Date(u.data_expiracao) > new Date())).length;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Administração</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Painel administrativo</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Assinantes ativos" value={active} />
        <Kpi label="Total cadastrados" value={initialUsers.length} />
        <Kpi label="Requisições API (24h)" value={usage.total24h} />
        <Kpi label="Requisições API (30d)" value={usage.total30d} hint={`${usage.failures30d} falhas · ${usage.cacheHits30d ?? 0} hits de cache`} />
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn("relative px-4 py-2.5 text-sm", tab === t.id ? "font-medium text-ink" : "text-ink-soft hover:text-ink")}
          >
            {t.label}
            {tab === t.id && <span className="absolute inset-x-3 -bottom-px h-[2px] bg-primary" />}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab initial={initialUsers} />}
      {tab === "logs" && <LogsTab logs={logs} />}
      {tab === "usage" && <UsageTab usage={usage} />}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value.toLocaleString("pt-BR")}</p>
      {hint && <p className="mt-0.5 text-[11px] text-ink-faint">{hint}</p>}
    </Card>
  );
}

function statusBadge(u: User) {
  if (u.status === "suspenso") return <Badge variant="danger">Suspenso</Badge>;
  if (u.role !== "admin" && (!u.data_expiracao || new Date(u.data_expiracao) <= new Date())) return <Badge variant="warning">Expirado</Badge>;
  if (u.status === "ativo") return <Badge variant="success">Ativo</Badge>;
  return <Badge>{u.status}</Badge>;
}

function UsersTab({ initial }: { initial: User[] }) {
  const [users, setUsers] = useState(initial);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    const r = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    if (r.ok) setUsers(j.users);
  }

  async function act(email: string, action: string, days = 30) {
    setBusy(email + action);
    const r = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, action, days }) });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) return toast.error(JSON.stringify(j.error));
    setUsers((list) => list.map((u) => (u.email === email ? j.user : u)));
    toast.success("Atualizado");
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <form onSubmit={search} className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por e-mail…" className="pl-9" />
        </form>
        <Button onClick={() => setOpen(true)}>
          <Plus /> Liberar acesso
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-y bg-canvas text-left text-xs text-ink-soft">
            <tr>
              <th className="px-5 py-2.5 font-medium">E-mail</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Origem</th>
              <th className="px-3 py-2.5 font-medium">Plano / oferta</th>
              <th className="px-3 py-2.5 font-medium">Expira em</th>
              <th className="px-3 py-2.5 font-medium">Último login</th>
              <th className="px-5 py-2.5 text-right font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b last:border-0 hover:bg-canvas/60">
                <td className="px-5 py-3">
                  <div className="font-medium text-ink">{u.email}</div>
                  <div className="text-xs text-ink-soft">
                    {u.name ?? "—"} {u.role === "admin" && <Badge variant="primary" className="ml-1">admin</Badge>}
                  </div>
                </td>
                <td className="px-3 py-3">{statusBadge(u)}</td>
                <td className="px-3 py-3">
                  <Badge variant={u.origem === "hotmart" ? "gold" : "outline"}>{u.origem}</Badge>
                </td>
                <td className="px-3 py-3 text-xs text-ink-soft">{u.plan_name ?? u.offer_code ?? "—"}</td>
                <td className="px-3 py-3 tabular-nums text-ink-soft">{u.role === "admin" ? "—" : fmtDate(u.data_expiracao)}</td>
                <td className="px-3 py-3 tabular-nums text-ink-soft">{fmtDate(u.last_login_at)}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(u.email, "renew", 30)}>
                      {busy === u.email + "renew" ? <Loader2 className="animate-spin" /> : <RefreshCw />} +30 dias
                    </Button>
                    {u.status === "suspenso" ? (
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(u.email, "activate")}>
                        Reativar
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => act(u.email, "suspend")} className="text-red-700 hover:text-red-800">
                        <Ban /> Suspender
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" title="Encerrar sessão ativa" disabled={!!busy} onClick={() => act(u.email, "reset_session")}>
                      <RotateCcw />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-ink-soft">Nenhum assinante encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
      <GrantDialog open={open} onOpenChange={setOpen} onDone={(u) => setUsers((l) => [u, ...l.filter((x) => x.email !== u.email)])} />
    </Card>
  );
}

function GrantDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: (u: User) => void }) {
  const [form, setForm] = useState({ email: "", name: "", days: 30, role: "user", notes: "", sendEmail: true });
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) return toast.error(typeof j.error === "string" ? j.error : "Dados inválidos");
    onDone(j.user);
    toast.success(`Acesso liberado · e-mail: ${j.email}`);
    onOpenChange(false);
    setForm({ email: "", name: "", days: 30, role: "user", notes: "", sendEmail: true });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Liberar acesso manual</DialogTitle>
          <DialogDescription>Para cortesias, vendas via Pix ou parcerias. Se o e-mail já existir, o prazo é somado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duração</Label>
              <NativeSelect value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}>
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
                <option value={180}>180 dias</option>
                <option value={365}>365 dias</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <NativeSelect value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">Usuário</option>
                <option value="admin">Admin</option>
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Ex.: Pix 12/11, cortesia parceiro…" />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} />
            Enviar e-mail de boas-vindas
          </label>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} Liberar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LogsTab({ logs }: { logs: Log[] }) {
  const [sel, setSel] = useState<Log | null>(null);
  const variant = (s: string) => (s === "processed" ? "success" : s === "error" || s === "unauthorized" ? "danger" : "default") as "success" | "danger" | "default";
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-canvas text-left text-xs text-ink-soft">
            <tr>
              <th className="px-5 py-2.5 font-medium">Recebido</th>
              <th className="px-3 py-2.5 font-medium">Evento</th>
              <th className="px-3 py-2.5 font-medium">E-mail</th>
              <th className="px-3 py-2.5 font-medium">Transação</th>
              <th className="px-3 py-2.5 font-medium">Hottok</th>
              <th className="px-3 py-2.5 font-medium">Processamento</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} onClick={() => setSel(l)} className="cursor-pointer border-b last:border-0 hover:bg-canvas/60">
                <td className="px-5 py-2.5 tabular-nums text-ink-soft">{fmtDate(l.received_at)}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{l.event}</td>
                <td className="px-3 py-2.5">{l.email ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-ink-soft">{l.transaction ?? "—"}</td>
                <td className="px-3 py-2.5">{l.hottok_valid ? <Badge variant="success">válido</Badge> : <Badge variant="danger">inválido</Badge>}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={variant(l.processing_status)}>{l.processing_status}</Badge>
                  {l.error_message && <div className="mt-0.5 max-w-xs truncate text-[11px] text-ink-faint">{l.error_message}</div>}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-ink-soft">Nenhum webhook recebido ainda.</td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{sel?.event}</DialogTitle>
            <DialogDescription>{sel?.error_message}</DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-md bg-ink p-4 text-[12px] leading-relaxed text-slate-200">{JSON.stringify(sel?.payload, null, 2)}</pre>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function UsageTab({ usage }: { usage: UsageSummary }) {
  const portals = Object.entries(usage.byPortal).sort((a, b) => b[1].ok + b[1].fail - (a[1].ok + a[1].fail));
  const max = Math.max(1, ...portals.map(([, v]) => v.ok + v.fail));
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle>Requisições por portal · 30 dias</CardTitle>
          <CardDescription>Cada requisição ao ZenRows/ScraperAPI consome créditos. Hits de cache não contam.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {portals.map(([portal, v]) => (
            <div key={portal}>
              <div className="mb-1 flex justify-between text-[13px]">
                <span className="text-ink">{portalLabel(portal)}</span>
                <span className="tabular-nums text-ink-soft">
                  {v.ok + v.fail} · {Math.round((v.ok / (v.ok + v.fail)) * 100)}% sucesso
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="bg-slate-700" style={{ width: `${(v.ok / max) * 100}%` }} />
                <div className="bg-carmesim-700/70" style={{ width: `${(v.fail / max) * 100}%` }} />
              </div>
            </div>
          ))}
          {portals.length === 0 && <p className="text-sm text-ink-soft">Nenhuma requisição registrada.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Por provedor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(usage.byProvider).map(([k, v]) => (
            <div key={k} className="flex justify-between border-b pb-2 last:border-0">
              <span className="font-mono text-xs">{k}</span>
              <span className="tabular-nums">{v.toLocaleString("pt-BR")}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-ink-soft">
            <span>Entradas de cache vigentes</span>
            <span className="tabular-nums">{usage.cacheEntries}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
