"""Classe base dos scrapers. Cada portal implementa build_urls() e parse_portal()."""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, ClassVar

from ..fetcher import AntiBotFetcher
from ..models import RawListing, SearchFilters
from ..parsing import (
    enrich_from_text,
    extract_embedded_json,
    extract_json_ld,
    find_listing_objects,
    generic_from_dict,
    is_recent,
    property_type_from_text,
)

log = logging.getLogger("scrapers")


class UnsupportedSearch(Exception):
    """O portal não oferece esta modalidade (ex.: vacacional no Idealista) → status 'skipped'."""


class BaseScraper(ABC):
    portal: ClassVar[str]
    base_url: ClassVar[str]
    #: True = só via ZenRows/ScraperAPI, nunca do IP do servidor
    protected: ClassVar[bool] = True
    js_render: ClassVar[bool] = True
    #: seletor CSS que indica que a lista carregou (ZenRows wait_for)
    wait_for: ClassVar[str | None] = None
    contratos: ClassVar[set[str]] = {"larga"}

    # ------------------------------------------------------------ API pública
    async def search(self, f: SearchFilters, fetcher: AntiBotFetcher) -> list[RawListing]:
        if f.contrato not in self.contratos:
            raise UnsupportedSearch(f"{self.portal} não oferece '{f.contrato}'")
        if not f.place:
            raise UnsupportedSearch("localização ausente")
        out: list[RawListing] = []
        seen: set[str] = set()
        for url in self.build_urls(f)[: f.max_paginas]:
            res = await fetcher.fetch(url, self.portal, protected=self.protected, js_render=self.js_render, wait_for=self.wait_for)
            page = self.parse(res.html, url)
            new = [x for x in page if x.url not in seen]
            seen.update(x.url for x in new)
            out.extend(new)
            if not new:  # página vazia => fim da paginação
                break
        return out

    def parse(self, html: str, url: str) -> list[RawListing]:
        """Tenta o parser específico; se vier vazio, cai para JSON embutido e JSON-LD."""
        records: list[dict[str, Any]] = []
        try:
            records = self.parse_portal(html, url)
        except Exception:  # noqa: BLE001 — layout mudou: segue para os genéricos
            log.exception("%s: parser específico falhou", self.portal)
        if not records:
            records = self.parse_generic(html)
        return [self.finalize(r) for r in records if r.get("url")]

    # ------------------------------------------------------------ a implementar
    @abstractmethod
    def build_urls(self, f: SearchFilters) -> list[str]:
        """URLs de busca (página 1..N) com o máximo de filtros nativos do portal."""

    def parse_portal(self, html: str, url: str) -> list[dict[str, Any]]:
        return []

    # ------------------------------------------------------------ auxiliares
    def parse_generic(self, html: str) -> list[dict[str, Any]]:
        recs: list[dict[str, Any]] = []
        for blob in extract_embedded_json(html):
            for d in find_listing_objects(blob):
                r = generic_from_dict(d, self.portal, self.base_url)
                if r and self.is_detail_url(r["url"]):
                    recs.append(r)
        if not recs:
            for d in extract_json_ld(html):
                t = d.get("@type")
                types = t if isinstance(t, list) else [t]
                if any(x in ("Apartment", "House", "SingleFamilyResidence", "Residence", "Accommodation", "Offer", "Product", "RealEstateListing") for x in types):
                    r = generic_from_dict(d, self.portal, self.base_url)
                    if r and self.is_detail_url(r["url"]):
                        recs.append(r)
        return recs

    def is_detail_url(self, url: str) -> bool:
        """Filtra links de navegação; sobrescrever por portal."""
        return url.startswith(self.base_url)

    def finalize(self, r: dict[str, Any]) -> RawListing:
        text = " ".join(filter(None, [r.get("title"), r.get("description"), " ".join(r.get("features") or [])]))
        enr = enrich_from_text(text)
        feats = list(dict.fromkeys([*(r.get("features") or []), *enr["features"]]))
        r = {**r, "features": feats, "negatives": enr["negatives"]}
        r["no_commission"] = bool(r.get("no_commission") or enr["no_commission"])
        r["particular"] = bool(r.get("particular") or enr["particular"])
        r["gastos_incluidos"] = bool(r.get("gastos_incluidos") or enr["gastos_incluidos"])
        r.setdefault("property_type", property_type_from_text(r.get("title") or ""))
        if not r.get("property_type"):
            r["property_type"] = property_type_from_text(r.get("title") or "")
        r["is_new"] = bool(r.get("is_new") or is_recent(r.get("published_at"), 24))
        if r.get("title"):
            r["title"] = " ".join(str(r["title"]).split())[:200]
        return RawListing(**{k: v for k, v in r.items() if k in RawListing.model_fields})
