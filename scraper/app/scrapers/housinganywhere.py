"""HousingAnywhere — médio prazo / estudantes e nômades."""
from __future__ import annotations

from urllib.parse import quote, urlencode

from ..models import SearchFilters
from ..slugs import primary_name, strip_accents
from .base import BaseScraper


class HousingAnywhereScraper(BaseScraper):
    portal = "housinganywhere"
    base_url = "https://housinganywhere.com"
    protected = False
    contratos = {"temporada", "larga"}

    def build_urls(self, f: SearchFilters) -> list[str]:
        city = strip_accents(primary_name(f.ciudad or f.provincia or "")).title().replace(" ", "-")
        # Preço é aplicado no pós-filtro (a unidade do parâmetro de URL do HA varia entre versões do site)
        q: dict[str, str | int] = {}
        if f.amueblado == "amueblado":
            q["furniture"] = "furnished"
        base = f"{self.base_url}/s/{quote(city)}--Spain"
        qs = f"?{urlencode(q)}" if q else ""
        return [f"{base}{qs}"] + [f"{base}?{urlencode({**q, 'page': n})}" for n in range(2, f.max_paginas + 1)]

    def is_detail_url(self, url: str) -> bool:
        return "/room/" in url or "/apartment" in url or "/rooms/" in url or "/listing" in url
