"""Contrato JSON compartilhado com o frontend (web/src/lib/types.ts)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PortalId = Literal["idealista", "fotocasa", "habitaclia", "pisos", "yaencontre", "milanuncios", "spotahome", "housinganywhere"]
ALL_PORTALS: list[str] = ["idealista", "fotocasa", "habitaclia", "pisos", "yaencontre", "milanuncios", "spotahome", "housinganywhere"]


class SearchFilters(BaseModel):
    comunidad: str | None = None
    provincia: str | None = None
    ciudad: str | None = None
    zonas: list[str] = Field(default_factory=list, max_length=10)
    habitaciones: list[Literal["0", "1", "2", "3", "4"]] = Field(default_factory=list)
    tipos: list[Literal["piso", "atico", "duplex", "chalet", "bajo_jardin"]] = Field(default_factory=list)
    contrato: Literal["larga", "temporada", "vacacional"] = "larga"
    precio_min: float | None = None
    precio_max: float | None = None
    metros_min: float | None = None
    gastos_incluidos: bool = False
    sin_comision: bool = False
    particular: bool = False
    amueblado: Literal["any", "amueblado", "sin_amueblar"] = "any"
    cocina_equipada: bool = False
    ascensor: bool = False
    aire_acondicionado: bool = False
    calefaccion: bool = False
    terraza: bool = False
    garaje: bool = False
    mascotas: bool = False
    publicado: Literal["any", "24h", "7d", "30d"] = "any"
    portales: list[PortalId] = Field(default_factory=lambda: list(ALL_PORTALS))
    max_paginas: int = Field(default=1, ge=1, le=3)

    @property
    def place(self) -> str:
        return self.ciudad or self.provincia or ""


class RawListing(BaseModel):
    """Anúncio de um único portal, antes da deduplicação."""
    portal: str
    url: str
    external_id: str | None = None
    title: str = ""
    price: float | None = None
    size_m2: float | None = None
    rooms: int | None = None
    bathrooms: int | None = None
    floor: str | None = None
    property_type: str | None = None
    city: str | None = None
    zone: str | None = None
    address: str | None = None
    image: str | None = None
    description: str | None = None
    published_at: str | None = None
    is_new: bool = False
    no_commission: bool = False
    particular: bool = False
    gastos_incluidos: bool = False
    features: list[str] = Field(default_factory=list)
    negatives: list[str] = Field(default_factory=list)   # ex.: "mascotas" quando o texto diz "no se admiten mascotas"
    lat: float | None = None
    lon: float | None = None


class ListingSource(BaseModel):
    portal: str
    url: str
    price: float | None = None
    external_id: str | None = None


class Listing(BaseModel):
    id: str
    title: str
    price: float | None
    price_m2: float | None
    size_m2: float | None
    rooms: int | None
    bathrooms: int | None
    floor: str | None
    property_type: str | None
    city: str | None
    zone: str | None
    address: str | None
    image: str | None
    description: str | None
    published_at: str | None
    is_new: bool
    no_commission: bool
    particular: bool
    features: list[str]
    lat: float | None
    lon: float | None
    sources: list[ListingSource]


SourceState = Literal["ok", "cached", "error", "timeout", "blocked", "skipped"]


class SourceStatus(BaseModel):
    portal: str
    status: SourceState
    count: int = 0
    duration_ms: int | None = None
    error: str | None = None


class SearchResponse(BaseModel):
    results: list[Listing]
    sources: list[SourceStatus]
    filters_hash: str
    generated_at: str
    total_raw: int
