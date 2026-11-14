"""Milanuncios (Adevinta) — protegido: somente via ZenRows/ScraperAPI.
Seção inmobiliaria / alquiler. Dados em window.__INITIAL_PROPS__ (JSON.parse)."""
from __future__ import annotations

from typing import Any
from urllib.parse import urlencode, urljoin

from ..models import SearchFilters
from ..parsing import clean, parse_number, parse_rooms, parse_size, soup_of
from ..slugs import city_slug, province_slug
from .base import BaseScraper


class MilanunciosScraper(BaseScraper):
    portal = "milanuncios"
    base_url = "https://www.milanuncios.com"
    protected = True
    contratos = {"larga", "vacacional"}

    def build_urls(self, f: SearchFilters) -> list[str]:
        city = city_slug(self.portal, f.ciudad)
        prov = province_slug(f.provincia)
        loc = f"{city}-{prov}" if city and prov and city != prov else (city or prov)
        cat = "alquiler-vacaciones" if f.contrato == "vacacional" else "alquiler-de-pisos"
        q: dict[str, Any] = {"demanda": "n", "orden": "date"}
        if f.precio_min:
            q["desde"] = int(f.precio_min)
        if f.precio_max:
            q["hasta"] = int(f.precio_max)
        if f.habitaciones:
            q["dormitoriosd"] = min(int(h) for h in f.habitaciones)
        if f.metros_min:
            q["m2d"] = int(f.metros_min)
        if f.particular:
            q["vendedor"] = "part"
        base = f"{self.base_url}/{cat}-en-{loc}/"
        return [f"{base}?{urlencode(q)}"] + [f"{base}?{urlencode({**q, 'pagina': n})}" for n in range(2, f.max_paginas + 1)]

    def is_detail_url(self, url: str) -> bool:
        return url.endswith(".htm") and "milanuncios.com" in url

    def parse_portal(self, html: str, url: str) -> list[dict[str, Any]]:
        soup = soup_of(html)
        out = []
        for art in soup.select("article.ma-AdCardV2, article[class*=AdCard]"):
            a = art.select_one("a.ma-AdCardListingV2-TitleLink, a[href$='.htm']")
            if not a:
                continue
            txt = clean(art.get_text(" "))
            price_el = art.select_one(".ma-AdPrice-value, [class*=AdPrice]")
            img = art.select_one("img")
            desc = art.select_one(".ma-AdCardV2-description, [class*=description]")
            out.append({
                "portal": self.portal,
                "url": urljoin(self.base_url, a["href"]),
                "title": clean(a.get_text()),
                "price": parse_number(price_el.get_text()) if price_el else None,
                "size_m2": parse_size(txt),
                "rooms": parse_rooms(txt),
                "image": (img.get("src") or img.get("data-src")) if img else None,
                "description": clean(desc.get_text())[:600] if desc else None,
                "particular": "particular" in txt.lower(),
            })
        return out
