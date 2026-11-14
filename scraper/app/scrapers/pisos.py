"""Pisos.com — não listado como alvo crítico; via provedor quando houver chave."""
from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

from ..models import SearchFilters
from ..parsing import clean, parse_number, parse_rooms, parse_size, soup_of
from ..slugs import city_slug, province_slug
from .base import BaseScraper

TIPOS = {"piso": "pisos", "atico": "aticos", "duplex": "duplex", "chalet": "casas", "bajo_jardin": "pisos"}


class PisosScraper(BaseScraper):
    portal = "pisos"
    base_url = "https://www.pisos.com"
    protected = False
    js_render = False
    contratos = {"larga", "temporada"}

    def build_urls(self, f: SearchFilters) -> list[str]:
        loc = city_slug(self.portal, f.ciudad, sep="_") or province_slug(f.provincia, sep="_")
        kind = TIPOS[f.tipos[0]] if len(f.tipos) == 1 else "pisos"
        section = "alquiler_temporal" if f.contrato == "temporada" else "alquiler"
        base = f"{self.base_url}/{section}/{kind}-{loc}/"
        if f.precio_max:
            base += f"hasta-{int(f.precio_max)}/"
        if f.precio_min:
            base += f"desde-{int(f.precio_min)}/"
        return [base] + [f"{base}{n}/" for n in range(2, f.max_paginas + 1)]

    def is_detail_url(self, url: str) -> bool:
        return "pisos.com/alquilar/" in url or "pisos.com/alquiler/" in url

    def parse_portal(self, html: str, url: str) -> list[dict[str, Any]]:
        soup = soup_of(html)
        out = []
        for card in soup.select("div.ad-preview, div[data-lnk-href], article.ad-preview"):
            href = card.get("data-lnk-href") or (card.select_one("a.ad-preview__title, a[href]") or {}).get("href")
            if not href:
                continue
            title_el = card.select_one(".ad-preview__title")
            chars = clean(" ".join(c.get_text(" ") for c in card.select(".ad-preview__char, .ad-preview__inline")))
            price_el = card.select_one(".ad-preview__price")
            sub = card.select_one(".ad-preview__subtitle")
            img = card.select_one("img")
            desc = card.select_one(".ad-preview__description")
            out.append({
                "portal": self.portal,
                "url": urljoin(self.base_url, href),
                "external_id": card.get("id"),
                "title": clean(title_el.get_text()) if title_el else "",
                "price": parse_number(price_el.get_text()) if price_el else None,
                "size_m2": parse_size(chars),
                "rooms": parse_rooms(chars),
                "zone": clean(sub.get_text()) if sub else None,
                "image": (img.get("src") or img.get("data-src")) if img else None,
                "description": clean(desc.get_text())[:600] if desc else None,
            })
        return out
