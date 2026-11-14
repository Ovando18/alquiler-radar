"""Spotahome — foco em alquiler de temporada / médio prazo (mensal)."""
from __future__ import annotations

from urllib.parse import urlencode

from ..models import SearchFilters
from ..slugs import city_slug
from .base import BaseScraper


class SpotahomeScraper(BaseScraper):
    portal = "spotahome"
    base_url = "https://www.spotahome.com"
    protected = False
    contratos = {"temporada", "larga"}

    def build_urls(self, f: SearchFilters) -> list[str]:
        city = city_slug(self.portal, f.ciudad or f.provincia)
        q: dict[str, str] = {}
        if f.precio_min or f.precio_max:
            q["budget"] = f"{int(f.precio_min or 0)}-{int(f.precio_max or 10000)}"
        rooms = sorted(int(h) for h in f.habitaciones)
        if rooms:
            q["bedrooms"] = ",".join(str(r) for r in rooms)
        q["type[]"] = "apartments" if 0 not in rooms else "studios"
        base = f"{self.base_url}/es/s/{city}"
        return [f"{base}?{urlencode(q)}"] + [f"{base}?{urlencode({**q, 'page': n})}" for n in range(2, f.max_paginas + 1)]

    def is_detail_url(self, url: str) -> bool:
        last = url.rstrip("/").split("/")[-1]
        return "spotahome.com" in url and ("/for-rent:" in url or "/alquiler" in url or last.isdigit())
    # parse_portal() vazio → usa o extrator genérico de JSON embutido (Next.js)
