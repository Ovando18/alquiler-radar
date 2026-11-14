"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { eur, fmtDate } from "@/lib/utils";
import type { SearchFilters } from "@/lib/types";
import { CONTRATO_OPTS } from "@/lib/filters";

type Saved = { id: string; name: string; filters: SearchFilters; created_at: string; last_run_at: string | null };

function summary(f: SearchFilters) {
  const parts: string[] = [];
  parts.push([f.ciudad, f.provincia].filter(Boolean).join(", "));
  if (f.habitaciones?.length) parts.push(f.habitaciones.map((h) => (h === "0" ? "Estudio" : `T${h === "4" ? "4+" : h}`)).join("/"));
  if (f.precio_min || f.precio_max) parts.push(`${f.precio_min ? eur(f.precio_min) : "0"} – ${f.precio_max ? eur(f.precio_max) : "∞"}`);
  parts.push(CONTRATO_OPTS.find((c) => c.v === f.contrato)?.es ?? "");
  return parts.filter(Boolean);
}

export default function BuscasSalvasPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Saved[] | null>(null);

  useEffect(() => {
    supabase
      .from("saved_searches")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setItems((data as Saved[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id: string) {
    const { error } = await supabase.from("saved_searches").delete().eq("id", id);
    if (error) return toast.error("Erro ao excluir.");
    setItems((l) => l?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <div className="max-w-4xl">
      <p className="eyebrow">Alertas</p>
      <h1 className="font-display text-2xl font-semibold">Buscas salvas</h1>

      {items && items.length === 0 && (
        <div className="mt-8 flex flex-col items-center rounded-lg border border-dashed bg-white py-20 text-center">
          <Bookmark className="h-7 w-7 text-ink-faint" />
          <p className="mt-3 font-medium">Nenhuma busca salva</p>
          <p className="mt-1 text-sm text-ink-soft">Faça uma busca e clique em “Salvar busca”.</p>
        </div>
      )}

      <div className="mt-6 divide-y rounded-lg border bg-white shadow-card">
        {items?.map((s) => (
          <div key={s.id} className="flex items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{s.name}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {summary(s.filters).map((p) => (
                  <Badge key={p} variant="outline">{p}</Badge>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-faint">Criada {fmtDate(s.created_at)} · última execução {fmtDate(s.last_run_at)}</p>
            </div>
            <Button asChild size="sm">
              <Link href={`/buscar?s=${s.id}`}>
                <Play /> Executar
              </Link>
            </Button>
            <Button size="icon" variant="ghost" onClick={() => remove(s.id)} title="Excluir">
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
