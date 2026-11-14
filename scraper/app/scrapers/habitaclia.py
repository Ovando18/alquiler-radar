"""Habitaclia (Adevinta, forte na Catalunha/Valência) — tratado como protegido."""
from __future__ import annotations

from typing import Any
from urllib.parse import urlencode, urljoin

from ..models import SearchFilters
from ..parsing import clean, parse_number, parse_rooms, parse_size, soup_of
from ..slugs import city_slug, province_slug
from .base import BaseScraper


class HabitacliaScraper(BaseScraper):
    portal = "habitaclia"
    base_url = "https://www.habitaclia.com"
    protected = True
    contratos = {"larga", "temporada"}

    def build_urls(self, f: SearchFilters) -> list[str]:
        loc = city_slug(self.portal, f.ciudad, sep="_") or province_slug(f.provincia, sep="_")
        kind = "alquiler-temporada" if f.contrato == "temporada" else "alquiler"
        q: dict[str, Any] = {"ordenar": "mas_recientes"}
        if f.precio_min:
            q["pmin"] = int(f.precio_min)
        if f.precio_max:
            q["pmax"] = int(f.precio_max)
        if f.metros_min:
            q["m2"] = int(f.metros_min)
        if f.habitaciones:
            q["hab"] = min(int(h) for h in f.habitaciones)
        qs = f"?{urlencode(q)}"
        return [f"{self.base_url}/{kind}-{loc}.htm{qs}"] + [
            f"{self.base_url}/{kind}-{loc}-{n - 1}.htm{qs}" for n in range(2, f.max_paginas + 1)
        ]

    def is_detail_url(self, url: str) -> bool:
        return "habitaclia.com" in url and ".htm" in url

    def parse_portal(self, html: str, url: str) -> list[dict[str, Any]]:
        soup = soup_of(html)
        out = []
        for art in soup.select("article.list-item, article[data-id], li.list-item-container article"):
            a = art.select_one("h3.list-item-title a, a.list-item-link, a[href*='.htm']")
            href = art.get("data-href") or (a.get("href") if a else None)
            if not href:
                continue
            feat_txt = clean(" ".join(x.get_text(" ") for x in art.select(".list-item-feature, .list-item-features")))
            price_el = art.select_one(".list-item-price span, .list-item-price, [itemprop=price]")
            img = art.select_one("img")
            loc = art.select_one(".list-item-location, .list-item-location span")
            desc = art.select_one(".list-item-description")
            out.append({
                "portal": self.portal,
                "url": urljoin(self.base_url, href),
                "external_id": art.get("data-id"),
                "title": clean(a.get_text()) if a else "",
                "price": parse_number(price_el.get_text()) if price_el else None,
                "size_m2": parse_size(feat_txt),
                "rooms": parse_rooms(feat_txt),
                "bathrooms": parse_number(feat_txt.split("baño")[0].split("-")[-1]) if "baño" in feat_txt else None,
                "image": (img.get("src") or img.get("data-src")) if img else None,
                "zone": clean(loc.get_text()) if loc else None,
                "description": clean(desc.get_text())[:600] if desc else None,
            })
        for r in out:
            if r["bathrooms"] is not None:
                r["bathrooms"] = int(r["bathrooms"])
        return out
