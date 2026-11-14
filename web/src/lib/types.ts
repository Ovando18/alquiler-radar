/** Contrato JSON compartilhado com o microserviço Python (scraper/app/models.py). */

export const PORTALS = [
  { id: "idealista", label: "Idealista" },
  { id: "fotocasa", label: "Fotocasa" },
  { id: "habitaclia", label: "Habitaclia" },
  { id: "pisos", label: "Pisos.com" },
  { id: "yaencontre", label: "Yaencontre" },
  { id: "milanuncios", label: "Milanuncios" },
  { id: "spotahome", label: "Spotahome" },
  { id: "housinganywhere", label: "HousingAnywhere" },
] as const;
export type PortalId = (typeof PORTALS)[number]["id"];
export const portalLabel = (id: string) => PORTALS.find((p) => p.id === id)?.label ?? id;

export type Habitaciones = "0" | "1" | "2" | "3" | "4";
export type TipoInmueble = "piso" | "atico" | "duplex" | "chalet" | "bajo_jardin";
export type Contrato = "larga" | "temporada" | "vacacional";
export type Publicado = "any" | "24h" | "7d" | "30d";
export type Amueblado = "any" | "amueblado" | "sin_amueblar";

export interface SearchFilters {
  comunidad: string | null;
  provincia: string | null;
  ciudad: string | null;
  zonas: string[];
  habitaciones: Habitaciones[];
  tipos: TipoInmueble[];
  contrato: Contrato;
  precio_min: number | null;
  precio_max: number | null;
  metros_min: number | null;
  gastos_incluidos: boolean;
  sin_comision: boolean;
  particular: boolean;
  amueblado: Amueblado;
  cocina_equipada: boolean;
  ascensor: boolean;
  aire_acondicionado: boolean;
  calefaccion: boolean;
  terraza: boolean;
  garaje: boolean;
  mascotas: boolean;
  publicado: Publicado;
  portales: PortalId[];
  max_paginas: number;
}

export const DEFAULT_FILTERS: SearchFilters = {
  comunidad: null,
  provincia: null,
  ciudad: null,
  zonas: [],
  habitaciones: [],
  tipos: [],
  contrato: "larga",
  precio_min: null,
  precio_max: null,
  metros_min: null,
  gastos_incluidos: false,
  sin_comision: false,
  particular: false,
  amueblado: "any",
  cocina_equipada: false,
  ascensor: false,
  aire_acondicionado: false,
  calefaccion: false,
  terraza: false,
  garaje: false,
  mascotas: false,
  publicado: "any",
  portales: PORTALS.map((p) => p.id),
  max_paginas: 1,
};

export interface ListingSource {
  portal: PortalId;
  url: string;
  price: number | null;
  external_id: string | null;
}

export interface Listing {
  id: string;
  title: string;
  price: number | null;
  price_m2: number | null;
  size_m2: number | null;
  rooms: number | null;
  bathrooms: number | null;
  floor: string | null;
  property_type: string | null;
  city: string | null;
  zone: string | null;
  address: string | null;
  image: string | null;
  description: string | null;
  published_at: string | null;
  is_new: boolean;
  no_commission: boolean;
  particular: boolean;
  features: string[];
  lat: number | null;
  lon: number | null;
  sources: ListingSource[];
}

export type SourceState = "ok" | "cached" | "error" | "timeout" | "blocked" | "skipped";

export interface SourceStatus {
  portal: PortalId;
  status: SourceState;
  count: number;
  duration_ms: number | null;
  error: string | null;
}

export interface SearchResponse {
  results: Listing[];
  sources: SourceStatus[];
  filters_hash: string;
  generated_at: string;
  total_raw: number;
}
