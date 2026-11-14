"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bookmark, Download, FileSpreadsheet, PanelLeftClose, PanelLeftOpen, SearchX, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { FiltersPanel } from "@/components/search/filters-panel";
import { ListingCard } from "@/components/search/listing-card";
import { SourceStatusBar } from "@/components/search/source-status";
import { useFavorites } from "@/components/search/use-favorites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { cn, eur } from "@/lib/utils";
import { DEFAULT_FILTERS, type Listing, type SearchFilters, type SearchResponse } from "@/lib/types";

type Sort = "relevance" | "price_asc" | "price_desc" | "m2_asc" | "size_desc" | "newest";
const LS_KEY = "ar_last_filters";

export function SearchWorkspace() {
  const params = useSearchParams();
  const supabase = createClient();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("relevance");
  const [onlyNew, setOnlyNew] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const { favs, toggle, saveNote } = useFavorites();

  // Restaura busca salva (?s=id) ou a última busca local
  useEffect(() => {
    const id = params.get("s");
    if (id) {
      supabase
        .from("saved_searches")
        .select("filters")
        .eq("id", id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.filters) {
            const f = { ...DEFAULT_FILTERS, ...(data.filters as SearchFilters) };
            setFilters(f);
            run(f);
            supabase.from("saved_searches").update({ last_run_at: new Date().toISOString() }).eq("id", id).then(() => {});
          }
        });
      return;
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setFilters({ ...DEFAULT_FILTERS, ...JSON.parse(raw) });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function run(f: SearchFilters = filters) {
    setLoading(true);
    setError(null);
    setMobileFilters(false);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(f));
    } catch {}
    try {
      const r = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const j = await r.json();
      if (!r.ok) throw new Error(typeof j.error === "string" ? j.error : "Falha na busca");
      setData(j);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const results = useMemo(() => {
    let list = data?.results ?? [];
    if (onlyNew) list = list.filter((l) => l.is_new);
    const by = (fn: (l: Listing) => number | null, dir = 1) =>
      [...list].sort((a, b) => {
        const x = fn(a), y = fn(b);
        if (x == null) return 1;
        if (y == null) return -1;
        return (x - y) * dir;
      });
    switch (sort) {
      case "price_asc": return by((l) => l.price);
      case "price_desc": return by((l) => l.price, -1);
      case "m2_asc": return by((l) => l.price_m2);
      case "size_desc": return by((l) => l.size_m2, -1);
      case "newest": return by((l) => (l.published_at ? new Date(l.published_at).getTime() : null), -1);
      default: return list;
    }
  }, [data, sort, onlyNew]);

  const stats = useMemo(() => {
    const prices = results.map((r) => r.price).filter((p): p is number => p != null).sort((a, b) => a - b);
    return prices.length ? { median: prices[Math.floor(prices.length / 2)], min: prices[0] } : null;
  }, [results]);

  async function exportAs(format: "xlsx" | "csv") {
    const r = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listings: results, format, title: filters.ciudad ?? filters.provincia ?? "busca" }),
    });
    if (!r.ok) return toast.error("Falha ao exportar");
    const blob = await r.blob();
    const name = r.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? `alquilerradar.${format}`;
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const place = [filters.zonas.join(", "), filters.ciudad, filters.provincia].filter(Boolean).join(" · ");

  return (
    <div className="flex gap-6">
      {/* Painel de filtros — recolhível no desktop, gaveta no mobile */}
      <aside
        className={cn(
          "fixed inset-0 z-50 bg-white lg:sticky lg:top-[76px] lg:z-auto lg:h-[calc(100vh-100px)] lg:w-[300px] lg:shrink-0 lg:overflow-hidden lg:rounded-lg lg:border lg:shadow-card",
          mobileFilters ? "block" : "hidden",
          panelOpen ? "lg:block" : "lg:hidden",
        )}
      >
        <button className="absolute right-4 top-3.5 text-xs text-ink-soft lg:hidden" onClick={() => setMobileFilters(false)}>
          Fechar
        </button>
        <FiltersPanel value={filters} onChange={setFilters} onSubmit={() => run()} loading={loading} />
      </aside>

      <section className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" className="hidden lg:inline-flex" onClick={() => setPanelOpen(!panelOpen)} title="Mostrar/ocultar filtros">
              {panelOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setMobileFilters(true)}>
              <SlidersHorizontal /> Filtros
            </Button>
            <div>
              <p className="eyebrow">Imóveis para alugar</p>
              <h1 className="font-display text-2xl font-semibold leading-tight">{place || "Nova busca"}</h1>
              {data && (
                <p className="mt-0.5 text-[13px] text-ink-soft">
                  <span className="font-medium text-ink">{results.length}</span> imóveis únicos
                  {data.total_raw > data.results.length && <> · {data.total_raw - data.results.length} anúncios duplicados agrupados</>}
                  {stats && <> · mediana {eur(stats.median)} · a partir de {eur(stats.min)}</>}
                </p>
              )}
            </div>
          </div>

          {data && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOnlyNew(!onlyNew)}
                className={cn(
                  "h-9 rounded-md border px-3 text-[13px]",
                  onlyNew ? "border-ocre-400/50 bg-ocre-100 font-medium text-ocre-800" : "bg-white text-ink-soft hover:text-ink",
                )}
              >
                Só novos 24h
              </button>
              <div className="w-48">
                <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-9 text-[13px]">
                  <option value="relevance">Relevância</option>
                  <option value="price_asc">Menor preço</option>
                  <option value="price_desc">Maior preço</option>
                  <option value="m2_asc">Menor €/m²</option>
                  <option value="size_desc">Maior área</option>
                  <option value="newest">Mais recentes</option>
                </NativeSelect>
              </div>
              <Button variant="outline" size="sm" className="h-9" onClick={() => setSaveOpen(true)}>
                <Bookmark /> Salvar busca
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={() => exportAs("xlsx")} disabled={!results.length}>
                <FileSpreadsheet /> Excel
              </Button>
              <Button variant="outline" size="sm" className="h-9" onClick={() => exportAs("csv")} disabled={!results.length}>
                <Download /> CSV
              </Button>
            </div>
          )}
        </div>

        {data && (
          <div className="mb-5">
            <SourceStatusBar sources={data.sources} />
          </div>
        )}

        {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        {loading ? (
          <Skeletons />
        ) : !data ? (
          <EmptyStart />
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed bg-white py-20 text-center">
            <SearchX className="h-8 w-8 text-ink-faint" />
            <p className="mt-3 font-medium">Nenhum imóvel encontrado</p>
            <p className="mt-1 max-w-sm text-sm text-ink-soft">Tente ampliar a faixa de preço, remover características obrigatórias ou incluir mais portais.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {results.map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                favorite={!!favs[l.id]}
                note={favs[l.id]?.note ?? null}
                onToggleFavorite={() => toggle(l)}
                onSaveNote={(n) => saveNote(l, n)}
              />
            ))}
          </div>
        )}
      </section>

      <SaveSearchDialog open={saveOpen} onOpenChange={setSaveOpen} filters={filters} defaultName={place} />
    </div>
  );
}

function SaveSearchDialog({ open, onOpenChange, filters, defaultName }: { open: boolean; onOpenChange: (v: boolean) => void; filters: SearchFilters; defaultName: string }) {
  const supabase = createClient();
  const [name, setName] = useState("");
  useEffect(() => setName(defaultName), [defaultName, open]);

  async function save() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("saved_searches").insert({ user_id: user.id, name: name || "Minha busca", filters });
    if (error) return toast.error("Erro ao salvar a busca.");
    toast.success("Busca salva.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar busca</DialogTitle>
          <DialogDescription>Reabra estes filtros com um clique em “Buscas salvas”.</DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Elche T2 até 900 €" autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Skeletons() {
  return (
    <div>
      <p className="mb-4 text-[13px] text-ink-soft">Consultando os portais em paralelo. Buscas novas levam de 20 a 60 segundos; buscas repetidas saem do cache na hora.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg border bg-white">
            <div className="aspect-[4/3] animate-pulse bg-slate-100" />
            <div className="space-y-2 p-4">
              <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyStart() {
  return (
    <div className="rounded-lg border bg-white px-8 py-16">
      <div className="mx-auto max-w-lg text-center">
        <p className="eyebrow">Como funciona</p>
        <h2 className="mt-2 font-display text-2xl font-semibold">Uma busca, oito portais</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Defina a localização e os filtros ao lado. Consultamos Idealista, Fotocasa, Habitaclia, Pisos.com, Yaencontre, Milanuncios,
          Spotahome e HousingAnywhere ao mesmo tempo, agrupamos anúncios repetidos e mostramos o status de cada fonte.
        </p>
      </div>
    </div>
  );
}
