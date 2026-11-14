"use client";
import Link from "next/link";
import { Heart } from "lucide-react";
import { ListingCard } from "@/components/search/listing-card";
import { useFavorites } from "@/components/search/use-favorites";
import { Button } from "@/components/ui/button";

export default function FavoritosPage() {
  const { favs, loaded, toggle, saveNote } = useFavorites();
  const list = Object.values(favs).sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div>
      <p className="eyebrow">Sua seleção</p>
      <h1 className="font-display text-2xl font-semibold">Favoritos</h1>
      <p className="mt-1 text-[13px] text-ink-soft">Os dados são um retrato do momento em que você salvou — confira o anúncio original antes de visitar.</p>

      {loaded && list.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-lg border border-dashed bg-white py-20 text-center">
          <Heart className="h-7 w-7 text-ink-faint" />
          <p className="mt-3 font-medium">Nenhum favorito ainda</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/buscar">Ir para a busca</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((f) => (
            <ListingCard key={f.property_key} listing={f.data} favorite note={f.note} onToggleFavorite={() => toggle(f.data)} onSaveNote={(n) => saveNote(f.data, n)} />
          ))}
        </div>
      )}
    </div>
  );
}
