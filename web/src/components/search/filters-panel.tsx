"use client";
import { useState } from "react";
import { ChevronDown, Loader2, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { COMUNIDADES, ciudadesDe, comunidadDaProvincia, provinciasDe } from "@/lib/locations";
import { CONDICOES_OPTS, CONTRATO_OPTS, FEATURE_OPTS, HABITACIONES_OPTS, PUBLICADO_OPTS, TIPOS_OPTS } from "@/lib/filters";
import { DEFAULT_FILTERS, PORTALS, type SearchFilters } from "@/lib/types";

type Props = {
  value: SearchFilters;
  onChange: (f: SearchFilters) => void;
  onSubmit: () => void;
  loading: boolean;
};

function Group({ title, children, defaultOpen = true, count }: { title: string; children: React.ReactNode; defaultOpen?: boolean; count?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b px-5 py-4 last:border-0">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
        <span className="eyebrow flex items-center gap-2">
          {title}
          {!!count && <span className="rounded-full bg-carmesim-50 px-1.5 text-[10px] text-carmesim-700">{count}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-3.5 space-y-3">{children}</div>}
    </section>
  );
}

function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2.5 py-1.5 text-[13px] transition-colors",
        active ? "border-primary bg-carmesim-50 font-medium text-carmesim-700" : "border-border bg-white text-ink-soft hover:border-slate-300 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function Check({ checked, onChange, label, es }: { checked: boolean; onChange: (v: boolean) => void; label: string; es?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} className="mt-0.5" />
      <span>
        {label} {es && <span className="text-ink-faint">({es})</span>}
      </span>
    </label>
  );
}

export function FiltersPanel({ value: f, onChange, onSubmit, loading }: Props) {
  const set = <K extends keyof SearchFilters>(k: K, v: SearchFilters[K]) => onChange({ ...f, [k]: v });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const [zona, setZona] = useState("");

  const featureCount = FEATURE_OPTS.filter((o) => f[o.k]).length + (f.amueblado !== "any" ? 1 : 0);
  const condCount = CONDICOES_OPTS.filter((o) => f[o.k]).length + (f.precio_min ? 1 : 0) + (f.precio_max ? 1 : 0) + (f.metros_min ? 1 : 0);
  const numOrNull = (s: string) => (s === "" ? null : Math.max(0, Number(s)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex h-full flex-col"
    >
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold">Filtros</h2>
        <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink">
          <RotateCcw className="h-3 w-3" /> Limpar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Group title="Localização">
          <div className="space-y-1.5">
            <Label>Comunidade Autônoma</Label>
            <NativeSelect value={f.comunidad ?? ""} onChange={(e) => onChange({ ...f, comunidad: e.target.value || null, provincia: null, ciudad: null })}>
              <option value="">Todas</option>
              {COMUNIDADES.map((c) => (
                <option key={c.nombre}>{c.nombre}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Província</Label>
            <NativeSelect
              value={f.provincia ?? ""}
              onChange={(e) => {
                const p = e.target.value || null;
                onChange({ ...f, provincia: p, comunidad: p ? comunidadDaProvincia(p) : f.comunidad, ciudad: null });
              }}
            >
              <option value="">Selecione…</option>
              {provinciasDe(f.comunidad).map((p) => (
                <option key={p.nombre}>{p.nombre}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ciudad">Cidade / Município</Label>
            <Input id="ciudad" list="ciudades" value={f.ciudad ?? ""} onChange={(e) => set("ciudad", e.target.value || null)} placeholder="Ex.: Elche / Elx" />
            <datalist id="ciudades">
              {ciudadesDe(f.comunidad, f.provincia).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zona">
              Bairro / Distrito <span className="font-normal text-ink-faint">(barrio / zona)</span>
            </Label>
            <div className="flex gap-2">
              <Input
                id="zona"
                value={zona}
                onChange={(e) => setZona(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && zona.trim()) {
                    e.preventDefault();
                    if (!f.zonas.includes(zona.trim())) set("zonas", [...f.zonas, zona.trim()]);
                    setZona("");
                  }
                }}
                placeholder="Enter para adicionar"
              />
            </div>
            {f.zonas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {f.zonas.map((z) => (
                  <span key={z} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-ink">
                    {z}
                    <button type="button" onClick={() => set("zonas", f.zonas.filter((x) => x !== z))}>
                      <X className="h-3 w-3 text-ink-faint hover:text-ink" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </Group>

        <Group title="Tipologia" count={f.habitaciones.length + f.tipos.length}>
          <div>
            <Label className="mb-2 block text-ink-soft">Quartos (habitaciones)</Label>
            <div className="flex flex-wrap gap-1.5">
              {HABITACIONES_OPTS.map((o) => (
                <Chip key={o.v} title={o.hint} active={f.habitaciones.includes(o.v)} onClick={() => set("habitaciones", toggle(f.habitaciones, o.v))}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-ink-soft">Tipo de imóvel</Label>
            <div className="flex flex-wrap gap-1.5">
              {TIPOS_OPTS.map((o) => (
                <Chip key={o.v} title={o.label} active={f.tipos.includes(o.v)} onClick={() => set("tipos", toggle(f.tipos, o.v))}>
                  {o.es}
                </Chip>
              ))}
            </div>
          </div>
        </Group>

        <Group title="Contrato">
          <div className="grid gap-1.5">
            {CONTRATO_OPTS.map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => set("contrato", o.v)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left transition-colors",
                  f.contrato === o.v ? "border-primary bg-carmesim-50" : "border-border bg-white hover:border-slate-300",
                )}
              >
                <div className={cn("text-[13px] font-medium", f.contrato === o.v ? "text-carmesim-700" : "text-ink")}>
                  {o.label} <span className="font-normal text-ink-faint">({o.es})</span>
                </div>
                <div className="text-[11px] text-ink-soft">{o.hint}</div>
              </button>
            ))}
          </div>
        </Group>

        <Group title="Preço e condições" count={condCount}>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Mín. €/mês</Label>
              <Input type="number" inputMode="numeric" min={0} step={50} value={f.precio_min ?? ""} onChange={(e) => set("precio_min", numOrNull(e.target.value))} placeholder="500" />
            </div>
            <div className="space-y-1.5">
              <Label>Máx. €/mês</Label>
              <Input type="number" inputMode="numeric" min={0} step={50} value={f.precio_max ?? ""} onChange={(e) => set("precio_max", numOrNull(e.target.value))} placeholder="1.200" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Área mínima (m²)</Label>
            <Input type="number" inputMode="numeric" min={0} step={5} value={f.metros_min ?? ""} onChange={(e) => set("metros_min", numOrNull(e.target.value))} placeholder="60" />
          </div>
          {CONDICOES_OPTS.map((o) => (
            <Check key={o.k} checked={f[o.k]} onChange={(v) => set(o.k, v)} label={o.label} es={o.es} />
          ))}
        </Group>

        <Group title="Características" count={featureCount} defaultOpen={false}>
          <div className="grid grid-cols-3 gap-1 rounded-md bg-secondary p-1">
            {(
              [
                ["any", "Indiferente"],
                ["amueblado", "Mobiliado"],
                ["sin_amueblar", "Sem mobília"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => set("amueblado", v)}
                className={cn("rounded px-2 py-1.5 text-xs", f.amueblado === v ? "bg-white font-medium text-ink shadow-sm" : "text-ink-soft")}
              >
                {l}
              </button>
            ))}
          </div>
          {FEATURE_OPTS.map((o) => (
            <Check key={o.k} checked={f[o.k]} onChange={(v) => set(o.k, v)} label={o.label} es={o.es} />
          ))}
        </Group>

        <Group title="Publicação" defaultOpen={false} count={f.publicado !== "any" ? 1 : 0}>
          <div className="grid grid-cols-2 gap-1.5">
            {PUBLICADO_OPTS.map((o) => (
              <Chip key={o.v} active={f.publicado === o.v} onClick={() => set("publicado", o.v)}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Group>

        <Group title="Portais" defaultOpen={false} count={f.portales.length}>
          <div className="grid grid-cols-2 gap-2">
            {PORTALS.map((p) => (
              <Check
                key={p.id}
                checked={f.portales.includes(p.id)}
                onChange={() => {
                  const next = toggle(f.portales, p.id);
                  if (next.length) set("portales", next);
                }}
                label={p.label}
              />
            ))}
          </div>
          <div className="space-y-1.5 pt-1">
            <Label>Páginas por portal</Label>
            <NativeSelect value={f.max_paginas} onChange={(e) => set("max_paginas", Number(e.target.value))}>
              <option value={1}>1 página (mais rápido, menos créditos)</option>
              <option value={2}>2 páginas</option>
              <option value={3}>3 páginas</option>
            </NativeSelect>
          </div>
        </Group>
      </div>

      <div className="border-t bg-white p-4">
        <Button type="submit" size="lg" className="w-full" disabled={loading || (!f.ciudad && !f.provincia)}>
          {loading ? <Loader2 className="animate-spin" /> : <Search />}
          {loading ? "Consultando portais…" : "Buscar imóveis"}
        </Button>
        {!f.ciudad && !f.provincia && <p className="mt-2 text-center text-[11px] text-ink-faint">Escolha ao menos uma província ou cidade.</p>}
      </div>
    </form>
  );
}
