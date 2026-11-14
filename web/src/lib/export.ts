import type { Listing } from "./types";
import { portalLabel } from "./types";

export const EXPORT_COLUMNS: { header: string; key: string; width: number; get: (l: Listing) => string | number | null }[] = [
  { header: "Título", key: "title", width: 48, get: (l) => l.title },
  { header: "Preço (€/mês)", key: "price", width: 14, get: (l) => l.price },
  { header: "€/m²", key: "price_m2", width: 9, get: (l) => l.price_m2 },
  { header: "m²", key: "size", width: 8, get: (l) => l.size_m2 },
  { header: "Habitaciones", key: "rooms", width: 13, get: (l) => l.rooms },
  { header: "Baños", key: "baths", width: 8, get: (l) => l.bathrooms },
  { header: "Planta", key: "floor", width: 10, get: (l) => l.floor },
  { header: "Tipo", key: "type", width: 12, get: (l) => l.property_type },
  { header: "Cidade", key: "city", width: 18, get: (l) => l.city },
  { header: "Zona / Bairro", key: "zone", width: 22, get: (l) => l.zone },
  { header: "Endereço", key: "address", width: 30, get: (l) => l.address },
  { header: "Sem comissão", key: "nocom", width: 12, get: (l) => (l.no_commission ? "Sim" : "") },
  { header: "Particular", key: "part", width: 10, get: (l) => (l.particular ? "Sim" : "") },
  { header: "Características", key: "features", width: 36, get: (l) => l.features.join(", ") },
  { header: "Publicado", key: "published", width: 18, get: (l) => l.published_at },
  { header: "Portais", key: "portals", width: 26, get: (l) => l.sources.map((s) => portalLabel(s.portal)).join(" · ") },
  { header: "Link principal", key: "url", width: 60, get: (l) => l.sources[0]?.url ?? null },
  { header: "Outros links", key: "urls", width: 60, get: (l) => l.sources.slice(1).map((s) => s.url).join("\n") },
];

export function toCsv(listings: Listing[]): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // ";" + BOM: abre corretamente no Excel em pt-BR/es-ES
  const lines = [EXPORT_COLUMNS.map((c) => c.header).join(";")];
  for (const l of listings) lines.push(EXPORT_COLUMNS.map((c) => esc(c.get(l))).join(";"));
  return "﻿" + lines.join("\r\n");
}
