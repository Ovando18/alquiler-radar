"""Idealista — protegido por DataDome: somente via ZenRows/ScraperAPI.

Formato de URL (filtros no caminho, separados por vírgula):
  https://www.idealista.com/alquiler-viviendas/elche-elx-alicante/con-precio-hasta_1000,de-dos-dormitorios,amueblado_amueblados/pagina-2.htm
⚠ Os slugs de filtro abaixo refletem a estrutura pública do site; valide no navegador
  ao configurar (o Idealista renomeia filtros ocasionalmente).
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

from ..models import SearchFilters
from ..parsing import clean, parse_number, parse_rooms, parse_size, soup_of
from ..slugs import city_slug, province_slug
from .base import BaseScraper

ROOMS = {"0": "estudios", "1": "de-un-dormitorio", "2": "de-dos-dormitorios", "3": "de-tres-dormitorios", "4": "de-cuatro-cinco-habitaciones-o-mas"}
TIPOS = {"piso": "pisos", "atico": "aticos", "duplex": "duplex", "chalet": "chalets", "bajo_jardin": "pisos"}
PUBLICADO = {"24h": "publicado_ultimas-24-horas", "7d": "publicado_ultima-semana", "30d": "publicado_ultimo-mes"}
FEATURES = {
    "ascensor": "ascensor",
    "aire_acondicionado": "aire-acondicionado",
    "terraza": "terraza",
    "garaje": "garaje",
    "mascotas": "mascotas",
}


class IdealistaScraper(BaseScraper):
    portal = "idealista"
    base_url = "https://www.idealista.com"
    protected = True
    wait_for = "article.item"
    contratos = {"larga", "temporada"}

    def build_urls(self, f: SearchFilters) -> list[str]:
        city = city_slug(self.portal, f.ciudad)
        prov = province_slug(f.provincia)
        loc = f"{city}-{prov}" if city and prov and not city.endswith(prov) else (city or f"{prov}-provincia")
        segs: list[str] = []
        if f.precio_max:
            segs.append(f"precio-hasta_{int(f.precio_max)}")
        if f.precio_min:
            segs.append(f"precio-desde_{int(f.precio_min)}")
        if f.metros_min:
            segs.append(f"metros-cuadrados-mas-de_{int(f.metros_min)}")
        segs += [ROOMS[h] for h in sorted(f.habitaciones)]
        segs += sorted({TIPOS[t] for t in f.tipos})
        if f.amueblado == "amueblado":
            segs.append("amueblado_amueblados")
        elif f.amueblado == "sin_amueblar":
            segs.append("amueblado_sin-amueblar")
        if f.cocina_equipada:
            segs.append("amueblado_cocina-equipada")
        segs += [slug for k, slug in FEATURES.items() if getattr(f, k)]
        if f.publicado in PUBLICADO:
            segs.append(PUBLICADO[f.publicado])
        if f.particular:
            segs.append("de-particulares")
        if f.contrato == "temporada":
            segs.append("alquiler-de-temporada")

        kind = "alquiler-viviendas"
        base = f"{self.base_url}/{kind}/{loc}/" + (f"con-{','.join(segs)}/" if segs else "")
        return [base] + [f"{base}pagina-{n}.htm" for n in range(2, f.max_paginas + 1)]

    def is_detail_url(self, url: str) -> bool:
        return "/inmueble/" in url

    def parse_portal(self, html: str, url: str) -> list[dict[str, Any]]:
        soup = soup_of(html)
        out = []
        for art in soup.select("article.item"):
            a = art.select_one("a.item-link")
            if not a or not a.get("href"):
                continue
            details = [clean(d.get_text()) for d in art.select(".item-detail-char .item-detail, span.item-detail")]
            rooms = next((parse_rooms(d) for d in details if "hab" in d.lower() or "estudio" in d.lower()), None)
            size = next((parse_size(d) for d in details if "m²" in d or "m2" in d), None)
            floor = next((d for d in details if "planta" in d.lower() or "bajo" in d.lower() or "ático" in d.lower()), None)
            img = art.select_one("picture img, img")
            desc = art.select_one(".item-description")
            tags = [clean(t.get_text()) for t in art.select(".listing-tags, .item-tags span, .item-parking")]
            out.append({
                "portal": self.portal,
                "url": urljoin(self.base_url, a["href"]),
                "external_id": art.get("data-element-id") or art.get("data-adid"),
                "title": clean(a.get("title") or a.get_text()),
                "price": parse_number(art.select_one(".item-price").get_text()) if art.select_one(".item-price") else None,
                "rooms": rooms,
                "size_m2": size,
                "floor": floor,
                "image": (img.get("src") or img.get("data-src")) if img else None,
                "description": clean(desc.get_text())[:600] if desc else None,
                "features": tags,
                "address": clean(a.get("title")).split(" en ")[-1] if a.get("title") and " en " in a.get("title") else None,
                "particular": not art.select_one(".logo-branding") and "particular" in art.get_text(" ").lower(),
            })
        return out
