"""Pós-filtro: garante os filtros mesmo quando o portal não os aplica na URL.
Regra: só exclui quando o dado é CONHECIDO e contradiz o filtro (dado ausente => mantém)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .models import RawListing, SearchFilters
from .slugs import strip_accents

PUBLICADO_H = {"24h": 24, "7d": 24 * 7, "30d": 24 * 30}
NEG_FLAGS = {"mascotas": "mascotas", "ascensor": "ascensor"}


def _norm(s: str | None) -> str:
    return strip_accents((s or "").lower())


def keep(r: RawListing, f: SearchFilters, now: datetime | None = None) -> bool:
    if r.price is not None:
        if f.precio_min and r.price < f.precio_min:
            return False
        if f.precio_max and r.price > f.precio_max:
            return False
        if r.price < 80:  # preço por noite/semana ou erro de parsing
            return False
    if f.metros_min and r.size_m2 is not None and r.size_m2 < f.metros_min:
        return False
    if f.habitaciones and r.rooms is not None:
        wanted = {int(h) for h in f.habitaciones}
        if not (r.rooms in wanted or (4 in wanted and r.rooms >= 4)):
            return False
    for flag, neg in NEG_FLAGS.items():
        if getattr(f, flag) and neg in r.negatives:
            return False
    if f.amueblado == "amueblado" and "amueblado" in r.negatives:
        return False
    if f.amueblado == "sin_amueblar" and "Amueblado" in r.features:
        return False
    if f.sin_comision and not r.no_commission and r.portal in ("idealista", "fotocasa", "habitaclia", "pisos", "yaencontre"):
        # nesses portais "sin comisión" só é conhecido pelo texto: exige menção explícita
        return False
    if f.gastos_incluidos and not r.gastos_incluidos:
        return False
    if f.publicado in PUBLICADO_H and r.published_at:
        now = now or datetime.now(timezone.utc)
        try:
            if now - datetime.fromisoformat(r.published_at) > timedelta(hours=PUBLICADO_H[f.publicado]):
                return False
        except ValueError:
            pass
    if f.zonas:
        hay = _norm(" ".join(filter(None, [r.zone, r.address, r.title, r.description])))
        if hay and not any(_norm(z) in hay for z in f.zonas):
            return False
    return True


def apply(items: list[RawListing], f: SearchFilters) -> list[RawListing]:
    return [r for r in items if keep(r, f)]
