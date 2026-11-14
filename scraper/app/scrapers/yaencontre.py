"""Yaencontre — JSON embutido + seletores de fallback."""
from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

from ..models import SearchFilters
from ..parsing import clean, parse_number, parse_rooms, parse_size, soup_of
from ..slugs import city_slug, province_slug
from .base import BaseScraper

TIPOS = {"piso": "pisos", "atico": "aticos", "duplex": "duplex", "chalet": "casas", "bajo_jardin": "pisos"}


class YaencontreScraper(BaseScraper):
    portal = "yaencontre"
    base_url = "https://www.yaencontre.com"
    protected = False
    contratos = {"larga"}

    def build_urls(self, f: SearchFilters) -> list[str]:
        loc = city_slug(self.portal, f.ciudad) or f"provincia-{province_slug(f.provincia)}"
        kind = TIPOS[f.tipos[0]] if len(f.tipos) == 1 else "viviendas"
        segs = []
        if f.precio_max:
            segs.append(f"precio-hasta-{int(f.precio_max)}")
        if f.habitaciones:
            segs.append(f"{min(int(h) for h in f.habitaciones)}-habitaciones")
        base = f"{self.base_url}/alquiler/{kind}/{loc}" + (f"/f-{'-'.join(segs)}" if segs else "")
        return [base] + [f"{base}/pag-{n}" for n in range(2, f.max_paginas + 1)]

    def is_detail_url(self, url: str) -> bool:
        return "/inmueble-" in url or "/alquiler/" in url

    def parse_portal(self, html: str, url: str) -> list[dict[str, Any]]:
        soup = soup_of(html)
        out = []
        for art in soup.select("article"):
            a = art.select_one("a[href*='inmueble'], h3 a, a.d-ellipsis")
            price_el = art.select_one(".price, [class*=price]")
            if not a or not price_el:
                continue
            txt = clean(art.get_text(" "))
            img = art.select_one("img")
            out.append({
                "portal": self.portal,
                "url": urljoin(self.base_url, a["href"]),
                "title": clean(a.get("title") or a.get_text()),
                "price": parse_number(price_el.get_text()),
                "size_m2": parse_size(txt),
                "rooms": parse_rooms(txt),
                "image": (img.get("src") or img.get("data-src")) if img else None,
                "description": txt[:400],
            })
        return out
