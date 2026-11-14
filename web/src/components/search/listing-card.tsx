"use client";
import { useState } from "react";
import { Bath, BedDouble, Building2, ExternalLink, Heart, ImageOff, Layers, Maximize2, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useFx } from "@/components/app/fx-provider";
import { brl, cn, eur } from "@/lib/utils";
import { portalLabel, type Listing } from "@/lib/types";

const roomsLabel = (r: number | null) => (r == null ? null : r === 0 ? "Estudio" : `T${r >= 4 ? "4+" : r}`);

export function ListingCard({
  listing: l,
  favorite,
  note,
  onToggleFavorite,
  onSaveNote,
}: {
  listing: Listing;
  favorite: boolean;
  note: string | null;
  onToggleFavorite: () => void;
  onSaveNote: (note: string) => void;
}) {
  const { rate, showBrl } = useFx();
  const [imgOk, setImgOk] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const primary = l.sources[0];

  return (
    <article className="group flex flex-col overflow-hidden rounded-lg border bg-card shadow-card transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-secondary">
        {l.image && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-faint">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
          {l.is_new && <Badge variant="gold" className="shadow-sm">Novo · 24h</Badge>}
          {l.no_commission && <Badge variant="gold" className="shadow-sm">Sin comisión</Badge>}
          {l.particular && <Badge className="bg-white/95 shadow-sm">Particular</Badge>}
        </div>
        <button
          onClick={onToggleFavorite}
          aria-label={favorite ? "Remover dos favoritos" : "Favoritar"}
          className={cn(
            "absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors",
            favorite ? "text-carmesim-700" : "text-ink-soft hover:text-ink",
          )}
        >
          <Heart className="h-4 w-4" fill={favorite ? "currentColor" : "none"} />
        </button>
        {l.sources.length > 1 && (
          <span className="absolute bottom-2.5 right-2.5 rounded bg-ink/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
            em {l.sources.length} portais
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold tabular-nums text-ink">{eur(l.price)}</span>
            <span className="text-xs text-ink-soft">/mês</span>
          </div>
          {l.price_m2 != null && <span className="text-xs tabular-nums text-ink-soft">{l.price_m2.toFixed(1).replace(".", ",")} €/m²</span>}
        </div>
        {showBrl && rate && l.price != null && <p className="text-xs tabular-nums text-ocre-800">≈ {brl(l.price * rate)}/mês</p>}

        <h3 className="mt-2 line-clamp-2 text-[14px] font-medium leading-snug text-ink" title={l.title}>
          {l.title}
        </h3>
        <p className="mt-1 truncate text-xs text-ink-soft">{[l.zone, l.city].filter(Boolean).join(" · ") || l.address || "—"}</p>

        <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px] text-ink-soft">
          {l.size_m2 != null && (
            <span className="flex items-center gap-1">
              <Maximize2 className="h-3.5 w-3.5" /> {l.size_m2} m²
            </span>
          )}
          {l.rooms != null && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {roomsLabel(l.rooms)}
            </span>
          )}
          {l.bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" /> {l.bathrooms}
            </span>
          )}
          {l.floor && (
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> {l.floor}
            </span>
          )}
          {l.property_type && (
            <span className="flex items-center gap-1 capitalize">
              <Building2 className="h-3.5 w-3.5" /> {l.property_type}
            </span>
          )}
        </div>

        {l.features.length > 0 && <p className="mt-2 line-clamp-1 text-[11px] text-ink-faint">{l.features.join(" · ")}</p>}
        {note && <p className="mt-2 line-clamp-2 rounded bg-ocre-50 px-2 py-1 text-[11px] text-ocre-800">📝 {note}</p>}

        <div className="mt-auto flex items-center gap-2 pt-4">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {l.sources.map((s) => (
              <a
                key={s.portal + s.url}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded border bg-white px-1.5 py-0.5 text-[11px] text-ink-soft hover:border-slate-300 hover:text-ink"
                title={s.price && s.price !== l.price ? `${portalLabel(s.portal)}: ${eur(s.price)}` : portalLabel(s.portal)}
              >
                {portalLabel(s.portal)}
                {s.price && s.price !== l.price && <span className="tabular-nums text-ocre-800">{eur(s.price)}</span>}
              </a>
            ))}
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Nota pessoal" onClick={() => setNoteOpen(true)}>
            <StickyNote />
          </Button>
          {primary && (
            <Button size="sm" variant="outline" asChild>
              <a href={primary.url} target="_blank" rel="noreferrer noopener">
                Ver <ExternalLink />
              </a>
            </Button>
          )}
        </div>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nota pessoal</DialogTitle>
            <DialogDescription className="line-clamp-1">{l.title}</DialogDescription>
          </DialogHeader>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ex.: Visitar sábado 11h · perguntar sobre fianza de 2 meses…" />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                onSaveNote(draft);
                setNoteOpen(false);
              }}
            >
              Salvar nota
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
