"""Deduplicação entre portais: o mesmo imóvel anunciado no Idealista e no Fotocasa vira um card só."""
from __future__ import annotations

import hashlib
import math
import re
from difflib import SequenceMatcher

from .models import Listing, ListingSource, RawListing
from .slugs import strip_accents

PORTAL_PRIORITY = ["idealista", "fotocasa", "habitaclia", "pisos", "yaencontre", "milanuncios", "spotahome", "housinganywhere"]
STOP = {"piso", "en", "alquiler", "de", "la", "el", "del", "calle", "c", "avenida", "av", "con", "y", "a", "apartamento",
        "vivienda", "planta", "m2", "hab", "habitaciones", "the", "for", "rent", "in", "flat"}


def _tokens(*parts: str | None) -> str:
    t = strip_accents(" ".join(p for p in parts if p).lower())
    words = [w for w in re.findall(r"[a-z0-9]+", t) if w not in STOP and len(w) > 1]
    return " ".join(sorted(set(words)))


def _haversine_m(a: RawListing, b: RawListing) -> float | None:
    if None in (a.lat, a.lon, b.lat, b.lon):
        return None
    r = 6_371_000
    p1, p2 = math.radians(a.lat), math.radians(b.lat)  # type: ignore[arg-type]
    dp = p2 - p1
    dl = math.radians(b.lon - a.lon)  # type: ignore[operator]
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def _img_key(url: str | None) -> str | None:
    if not url:
        return None
    name = url.split("?")[0].rstrip("/").split("/")[-1]
    return name if len(name) > 12 else None


def is_duplicate(a: RawListing, b: RawListing) -> bool:
    if a.url == b.url:
        return True
    if a.portal == b.portal and a.external_id and a.external_id == b.external_id:
        return True
    if a.price is None or b.price is None:
        return False
    if abs(a.price - b.price) > max(25.0, 0.03 * max(a.price, b.price)):
        return False
    if a.rooms is not None and b.rooms is not None and a.rooms != b.rooms:
        return False
    size_known = a.size_m2 is not None and b.size_m2 is not None
    if size_known and abs(a.size_m2 - b.size_m2) > max(3.0, 0.05 * max(a.size_m2, b.size_m2)):  # type: ignore[operator]
        return False

    dist = _haversine_m(a, b)
    if dist is not None:
        return dist <= 120
    ia, ib = _img_key(a.image), _img_key(b.image)
    if ia and ia == ib:
        return True
    sim = SequenceMatcher(None, _tokens(a.title, a.zone, a.address), _tokens(b.title, b.zone, b.address)).ratio()
    # Preço + quartos + área batendo exige menos semelhança textual
    return sim >= (0.55 if size_known else 0.8)


def _completeness(r: RawListing) -> int:
    return sum(v is not None and v != "" for v in (r.price, r.size_m2, r.rooms, r.bathrooms, r.image, r.zone, r.floor, r.description))


def _priority(r: RawListing) -> int:
    return PORTAL_PRIORITY.index(r.portal) if r.portal in PORTAL_PRIORITY else 99


def group(items: list[RawListing]) -> list[Listing]:
    n = len(items)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    # bucket por faixa de preço para não comparar todos contra todos
    order = sorted(range(n), key=lambda i: items[i].price if items[i].price is not None else -1)
    for idx, i in enumerate(order):
        pi = items[i].price
        for j in order[idx + 1:]:
            pj = items[j].price
            if pi is not None and pj is not None and pj - pi > max(25.0, 0.03 * pj):
                break
            if find(i) != find(j) and is_duplicate(items[i], items[j]):
                parent[find(j)] = find(i)

    clusters: dict[int, list[RawListing]] = {}
    for i in range(n):
        clusters.setdefault(find(i), []).append(items[i])

    out: list[Listing] = []
    for members in clusters.values():
        members.sort(key=lambda r: (_priority(r), -_completeness(r)))
        rep = max(members, key=lambda r: (_completeness(r), -_priority(r)))
        best_priority = members[0]
        pick = lambda attr: next((getattr(m, attr) for m in [rep, *members] if getattr(m, attr) not in (None, "")), None)  # noqa: E731
        prices = [m.price for m in members if m.price is not None]
        price = min(prices) if prices else None
        size = pick("size_m2")
        sources, seen = [], set()
        for m in members:
            if m.url in seen:
                continue
            seen.add(m.url)
            sources.append(ListingSource(portal=m.portal, url=m.url, price=m.price, external_id=m.external_id))
        key_src = f"{best_priority.portal}:{best_priority.external_id or best_priority.url}"
        dates = [m.published_at for m in members if m.published_at]
        out.append(
            Listing(
                id=hashlib.sha1(key_src.encode()).hexdigest()[:16],
                title=rep.title or best_priority.title or "Imóvel para alugar",
                price=price,
                price_m2=round(price / size, 1) if price and size else None,
                size_m2=size,
                rooms=pick("rooms"),
                bathrooms=pick("bathrooms"),
                floor=pick("floor"),
                property_type=pick("property_type"),
                city=pick("city"),
                zone=pick("zone"),
                address=pick("address"),
                image=pick("image"),
                description=pick("description"),
                published_at=max(dates) if dates else None,
                is_new=any(m.is_new for m in members),
                no_commission=any(m.no_commission for m in members),
                particular=any(m.particular for m in members),
                features=list(dict.fromkeys(f for m in members for f in m.features)),
                lat=pick("lat"),
                lon=pick("lon"),
                sources=sources,
            )
        )
    return out


def rank(listings: list[Listing]) -> list[Listing]:
    """Relevância: novos primeiro, depois mais fontes (anúncio confirmado), completude e preço."""
    return sorted(
        listings,
        key=lambda l: (
            not l.is_new,
            -len(l.sources),
            -(sum(x is not None for x in (l.size_m2, l.rooms, l.image, l.bathrooms))),
            l.price if l.price is not None else 1e9,
        ),
    )
