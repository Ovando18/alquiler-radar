"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Listing } from "@/lib/types";

export type Favorite = { property_key: string; note: string | null; data: Listing; created_at: string };

/** Favoritos + notas pessoais em saved_properties (RLS: somente o dono). */
export function useFavorites() {
  const supabase = createClient();
  const [favs, setFavs] = useState<Record<string, Favorite>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("saved_properties")
      .select("property_key, note, data, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setFavs(Object.fromEntries((data ?? []).map((f) => [f.property_key, f as Favorite])));
        setLoaded(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(
    async (l: Listing) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      if (favs[l.id]) {
        const prev = favs[l.id];
        setFavs(({ [l.id]: _, ...rest }) => rest);
        const { error } = await supabase.from("saved_properties").delete().eq("property_key", l.id);
        if (error) {
          setFavs((f) => ({ ...f, [l.id]: prev }));
          toast.error("Não foi possível remover.");
        }
      } else {
        const row = { property_key: l.id, note: null, data: l, created_at: new Date().toISOString() };
        setFavs((f) => ({ ...f, [l.id]: row }));
        const { error } = await supabase.from("saved_properties").upsert({ user_id: user.id, property_key: l.id, data: l }, { onConflict: "user_id,property_key" });
        if (error) {
          setFavs(({ [l.id]: _, ...rest }) => rest);
          toast.error("Não foi possível favoritar.");
        }
      }
    },
    [favs, supabase],
  );

  const saveNote = useCallback(
    async (l: Listing, note: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("saved_properties")
        .upsert({ user_id: user.id, property_key: l.id, data: l, note }, { onConflict: "user_id,property_key" });
      if (error) return toast.error("Erro ao salvar a nota.");
      setFavs((f) => ({ ...f, [l.id]: { property_key: l.id, data: l, note, created_at: f[l.id]?.created_at ?? new Date().toISOString() } }));
      toast.success("Nota salva — o imóvel também foi adicionado aos favoritos.");
    },
    [supabase],
  );

  return { favs, loaded, toggle, saveNote };
}
