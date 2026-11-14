"""Geração de slugs de localização por portal."""
from __future__ import annotations

import re
import unicodedata


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def slugify(s: str, sep: str = "-") -> str:
    s = strip_accents(s).lower().replace("'", "").replace("·", "")
    s = re.sub(r"[^a-z0-9]+", sep, s)
    return s.strip(sep)


def primary_name(s: str) -> str:
    """'Elche / Elx' -> 'Elche' ; 'Alicante / Alacant' -> 'Alicante'."""
    return s.split("/")[0].strip()


# Exceções conhecidas — o slug usado pelo portal difere do nome oficial.
# ⚠ Revise periodicamente: portais mudam rotas sem aviso.
CITY_OVERRIDES: dict[str, dict[str, str]] = {
    "idealista": {
        "alicante-alacant": "alicante-alacant",
        "elche-elx": "elche-elx",
        "valencia": "valencia",
        "palma": "palma-de-mallorca",
        "donostia-san-sebastian": "donostia-san-sebastian",
        "pamplona-iruna": "pamplona-iruna",
    },
    "fotocasa": {
        "alicante-alacant": "alicante-alacant",
        "valencia": "valencia-capital",
        "madrid": "madrid-capital",
        "barcelona": "barcelona-capital",
        "sevilla": "sevilla-capital",
        "malaga": "malaga-capital",
    },
    "habitaclia": {"alicante-alacant": "alicante", "elche-elx": "elche_elx", "valencia": "valencia"},
    "pisos": {"alicante-alacant": "alicante_alacant", "elche-elx": "elche_elx"},
}


def city_slug(portal: str, city: str | None, sep: str = "-") -> str:
    if not city:
        return ""
    full = slugify(city)
    override = CITY_OVERRIDES.get(portal, {}).get(full)
    if override:
        return override
    return slugify(city, sep)


def province_slug(province: str | None, sep: str = "-") -> str:
    if not province:
        return ""
    return slugify(primary_name(province), sep)
