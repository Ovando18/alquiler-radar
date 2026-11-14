"""Fotocasa (Adevinta) — protegido: somente via ZenRows/ScraperAPI.
Os dados vêm em window.__INITIAL_PROPS__ (lista `realEstates`)."""
from __future__ import annotations

from typing import Any
from urllib.parse import urlencode, urljoin

from ..models import SearchFilters
from ..parsing import extract_embedded_json, parse_number, parse_published
from ..slugs import city_slug, province_slug
from .base import BaseScraper

FEATURE_KEYS = {"rooms": "rooms", "bathrooms": "bathrooms", "surface": "size_m2", "floor": "floor"}


def _find_key(obj: Any, key: str, depth: int = 0) -> Any:
    if depth > 10:
        return None
    if isinstance(obj, dict):
        if key in obj:
            return obj[key]
        for v in obj.values():
            r = _find_key(v, key, depth + 1)
            if r is not None:
                return r
    elif isinstance(obj, list):
        for v in obj:
            r = _find_key(v, key, depth + 1)
            if r is not None:
                return r
    return None


class FotocasaScraper(BaseScraper):
    portal = "fotocasa"
    base_url = "https://www.fotocasa.es"
    protected = True
    contratos = {"larga", "temporada"}

    def build_urls(self, f: SearchFilters) -> list[str]:
        loc = city_slug(self.portal, f.ciudad) or f"{province_slug(f.provincia)}-provincia"
        q: dict[str, Any] = {"sortType": "publicationDate"}
        if f.precio_min:
            q["minPrice"] = int(f.precio_min)
        if f.precio_max:
            q["maxPrice"] = int(f.precio_max)
        if f.metros_min:
            q["minSurface"] = int(f.metros_min)
        if f.habitaciones:
            nums = sorted(int(h) for h in f.habitaciones)
            q["minRooms"] = nums[0]
            if nums[-1] < 4:
                q["maxRooms"] = nums[-1]
        if f.contrato == "temporada":
            q["temporaryRent"] = "true"
        base = f"{self.base_url}/es/alquiler/viviendas/{loc}/todas-las-zonas/l"
        return [f"{base}?{urlencode(q)}"] + [f"{base}/{n}?{urlencode(q)}" for n in range(2, f.max_paginas + 1)]

    def is_detail_url(self, url: str) -> bool:
        return "/d" in url or "/alquiler/" in url

    def parse_portal(self, html: str, url: str) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for blob in extract_embedded_json(html):
            items = _find_key(blob, "realEstates")
            if not isinstance(items, list):
                continue
            for it in items:
                if not isinstance(it, dict):
                    continue
                detail = it.get("detail") or {}
                href = detail.get("es") if isinstance(detail, dict) else detail
                href = href or it.get("url")
                if not href:
                    continue
                rec: dict[str, Any] = {
                    "portal": self.portal,
                    "url": urljoin(self.base_url, href),
                    "external_id": str(it.get("id")) if it.get("id") else None,
                    "title": it.get("title") or it.get("buildingSubtype") or "",
                    "price": parse_number(it.get("rawPrice") or it.get("price")),
                    "description": (it.get("description") or "")[:600] or None,
                    "published_at": parse_published(it.get("dateOriginal") or it.get("date")),
                }
                for feat in it.get("features") or []:
                    k, v = feat.get("key"), feat.get("value")
                    if k in FEATURE_KEYS:
                        rec[FEATURE_KEYS[k]] = v if k == "floor" else parse_number(v)
                    elif v:
                        rec.setdefault("features", []).append(str(k))
                if rec.get("rooms") is not None:
                    rec["rooms"] = int(rec["rooms"])
                if rec.get("bathrooms") is not None:
                    rec["bathrooms"] = int(rec["bathrooms"])
                if rec.get("floor") is not None:
                    rec["floor"] = f"Planta {rec['floor']}"
                media = it.get("multimedia") or []
                if media and isinstance(media[0], dict):
                    rec["image"] = media[0].get("src") or media[0].get("url")
                addr = it.get("address") or it.get("location") or {}
                if isinstance(addr, dict):
                    rec["zone"] = addr.get("neighborhood") or addr.get("district")
                    rec["city"] = addr.get("city") or addr.get("municipality")
                    coords = addr.get("coordinates") or {}
                    if coords.get("latitude"):
                        rec["lat"], rec["lon"] = coords.get("latitude"), coords.get("longitude")
                rec["particular"] = (it.get("advertiser") or {}).get("typeId") == 1 if isinstance(it.get("advertiser"), dict) else False
                if not rec["title"]:
                    rec["title"] = " · ".join(filter(None, ["Piso en alquiler", rec.get("zone"), rec.get("city")]))
                out.append(rec)
            if out:
                break
        return out
