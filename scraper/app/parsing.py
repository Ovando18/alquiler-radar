"""
Ferramentas de extração reutilizadas por todos os scrapers.

Estratégia em camadas (da mais estável para a mais frágil):
  1. JSON embutido na página (__NEXT_DATA__, __INITIAL_PROPS__, __INITIAL_STATE__ ...)
  2. JSON-LD schema.org
  3. Seletores CSS específicos do portal
O passo 1 sobrevive a redesigns de layout; seletores CSS quebram com frequência.
"""
from __future__ import annotations

import json
import re
from collections import deque
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from .slugs import strip_accents

# ---------------------------------------------------------------- números


def parse_number(text: Any) -> float | None:
    """'1.250 €/mes' -> 1250 ; '85,5 m²' -> 85.5 ; 1200 -> 1200."""
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return float(text)
    if isinstance(text, dict):
        for k in ("amount", "value", "price", "raw", "amountValue"):
            if k in text:
                return parse_number(text[k])
        return None
    s = str(text)
    m = re.search(r"\d[\d.\s,]*", s)
    if not m:
        return None
    num = m.group(0).strip().replace(" ", "")
    if re.fullmatch(r"\d{1,3}(\.\d{3})+(,\d+)?", num):       # 1.250,50 (es)
        num = num.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", num):     # 1,250.50 (en)
        num = num.replace(",", "")
    else:
        num = num.replace(",", ".")
    try:
        return float(num.rstrip("."))
    except ValueError:
        return None


def parse_int(text: Any) -> int | None:
    n = parse_number(text)
    return int(n) if n is not None else None


def parse_rooms(text: Any) -> int | None:
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return int(text)
    s = strip_accents(str(text)).lower()
    if "estudio" in s or "loft" in s:
        return 0
    m = re.search(r"(\d+)\s*(hab|dorm|habitac|bed|room|quarto)", s)
    if m:
        return int(m.group(1))
    return parse_int(s) if re.fullmatch(r"\s*\d+\s*", s) else None


def parse_size(text: Any) -> float | None:
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return float(text)
    m = re.search(r"(\d[\d.,]*)\s*(m²|m2|mts|metros|sqm)", str(text), re.I)
    return parse_number(m.group(1)) if m else None


# ---------------------------------------------------------------- texto → características

FEATURE_PATTERNS: dict[str, tuple[str, ...]] = {
    "Amueblado": (r"\bamueblad[oa]\b", r"\bfurnished\b"),
    "Cocina equipada": (r"cocina equipada", r"cocina amueblada"),
    "Ascensor": (r"\bascensor\b", r"\belevator\b", r"\blift\b"),
    "Aire acondicionado": (r"aire acondicionado", r"\ba/?c\b", r"climatizaci"),
    "Calefacción": (r"calefacci", r"\bheating\b"),
    "Terraza": (r"\bterraza\b", r"\bbalc[oó]n\b", r"\bterrace\b", r"\bbalcony\b"),
    "Garaje": (r"\bgaraje\b", r"\bparking\b", r"plaza de garaje", r"aparcamiento"),
    "Admite mascotas": (r"admite mascotas", r"se admiten mascotas", r"pets? allowed", r"pet[- ]friendly"),
    "Piscina": (r"\bpiscina\b", r"\bpool\b"),
}
NEGATIVE_PATTERNS: dict[str, tuple[str, ...]] = {
    "mascotas": (r"no (se )?admite[n]? mascotas", r"sin mascotas", r"no pets"),
    "ascensor": (r"sin ascensor",),
    "amueblado": (r"sin amueblar", r"vac[ií]o", r"unfurnished"),
}
NO_COMMISSION = (r"sin comisi[oó]n", r"sin gastos de agencia", r"sin honorarios", r"0\s*% comisi", r"no agency fee")
PARTICULAR = (r"\bparticular\b", r"directo (del|de) propietario", r"trato directo")
GASTOS_INCLUIDOS = (r"gastos incluidos", r"comunidad incluida", r"suministros incluidos", r"bills included")


def _any(patterns: Iterable[str], text: str) -> bool:
    return any(re.search(p, text) for p in patterns)


def enrich_from_text(text: str) -> dict[str, Any]:
    t = strip_accents(text.lower()) if text else ""
    t_acc = (text or "").lower()
    features = [name for name, pats in FEATURE_PATTERNS.items() if _any(pats, t_acc) or _any(pats, t)]
    negatives = [k for k, pats in NEGATIVE_PATTERNS.items() if _any(pats, t_acc) or _any(pats, t)]
    if "amueblado" in negatives and "Amueblado" in features:
        features.remove("Amueblado")
    return {
        "features": features,
        "negatives": negatives,
        "no_commission": _any(NO_COMMISSION, t_acc) or _any(NO_COMMISSION, t),
        "particular": _any(PARTICULAR, t_acc),
        "gastos_incluidos": _any(GASTOS_INCLUIDOS, t_acc) or _any(GASTOS_INCLUIDOS, t),
    }


def property_type_from_text(text: str) -> str | None:
    t = strip_accents((text or "").lower())
    for key, label in (("atico", "ático"), ("duplex", "dúplex"), ("chalet", "chalet"), ("casa", "casa"),
                       ("estudio", "estudio"), ("loft", "loft"), ("bajo", "bajo"), ("apartamento", "piso"), ("piso", "piso")):
        if re.search(rf"\b{key}\b", t):
            return label
    return None


# ---------------------------------------------------------------- datas

def parse_published(value: Any, now: datetime | None = None) -> str | None:
    """ISO 8601 ou textos relativos ('hace 3 horas', 'hoy', 'ayer', '2 days ago')."""
    if not value:
        return None
    now = now or datetime.now(timezone.utc)
    if isinstance(value, (int, float)):  # epoch (s ou ms)
        ts = value / 1000 if value > 10**11 else value
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    s = strip_accents(str(value).lower().strip())
    try:
        d = datetime.fromisoformat(s.replace("z", "+00:00"))
        return (d if d.tzinfo else d.replace(tzinfo=timezone.utc)).isoformat()
    except ValueError:
        pass
    if "hoy" in s or "today" in s or "ahora" in s:
        return now.isoformat()
    if "ayer" in s or "yesterday" in s:
        return (now - timedelta(days=1)).isoformat()
    m = re.search(r"(\d+)\s*(min|hora|hour|h\b|dia|day|semana|week|mes|month)", s)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        delta = (
            timedelta(minutes=n) if unit.startswith("min")
            else timedelta(hours=n) if unit.startswith(("hora", "hour", "h"))
            else timedelta(days=n) if unit.startswith(("dia", "day"))
            else timedelta(weeks=n) if unit.startswith(("semana", "week"))
            else timedelta(days=30 * n)
        )
        return (now - delta).isoformat()
    m = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m:
        return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1)), tzinfo=timezone.utc).isoformat()
    return None


def is_recent(iso: str | None, hours: int = 24, now: datetime | None = None) -> bool:
    if not iso:
        return False
    now = now or datetime.now(timezone.utc)
    try:
        return now - datetime.fromisoformat(iso) <= timedelta(hours=hours)
    except ValueError:
        return False


# ---------------------------------------------------------------- JSON embutido

_EMBED_PATTERNS = [
    re.compile(r"window\.__INITIAL_PROPS__\s*=\s*JSON\.parse\(\s*\"(.+?)\"\s*\)\s*;?\s*</script>", re.S),
    re.compile(r"window\.__INITIAL_PROPS__\s*=\s*(\{.+?\})\s*;?\s*</script>", re.S),
    re.compile(r"window\.__INITIAL_STATE__\s*=\s*(\{.+?\})\s*;?\s*</script>", re.S),
    re.compile(r"window\.__PRELOADED_STATE__\s*=\s*(\{.+?\})\s*;?\s*</script>", re.S),
    re.compile(r"window\.__NUXT__\s*=\s*(\{.+?\})\s*;?\s*</script>", re.S),
]


def extract_embedded_json(html: str) -> list[Any]:
    blobs: list[Any] = []
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.find_all("script", id="__NEXT_DATA__"):
        try:
            blobs.append(json.loads(tag.string or ""))
        except (json.JSONDecodeError, TypeError):
            pass
    for tag in soup.find_all("script", type="application/json"):
        txt = tag.string or ""
        if len(txt) > 500:
            try:
                blobs.append(json.loads(txt))
            except json.JSONDecodeError:
                pass
    for pat in _EMBED_PATTERNS:
        for m in pat.finditer(html):
            raw = m.group(1)
            try:
                if pat.pattern.find("JSON\\.parse") >= 0:
                    raw = json.loads(f'"{raw}"')  # desescapa a string JS
                blobs.append(json.loads(raw))
            except (json.JSONDecodeError, ValueError):
                continue
    return blobs


def extract_json_ld(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "lxml")
    out: list[dict] = []
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        queue = deque(data if isinstance(data, list) else [data])  # BFS: preserva a ordem da página
        while queue:
            d = queue.popleft()
            if isinstance(d, dict):
                out.append(d)
                for k in ("@graph", "itemListElement", "item", "mainEntity"):
                    v = d.get(k)
                    if isinstance(v, list):
                        queue.extend(v)
                    elif isinstance(v, dict):
                        queue.append(v)
    return out


# ---------------------------------------------------------------- objetos "com cara de anúncio"

K_PRICE = ("price", "precio", "rawPrice", "priceAmount", "priceValue", "rent", "monthlyRent", "monthly_price", "amount")
K_URL = ("url", "detailUrl", "detail_url", "link", "href", "permalink", "adUrl", "realEstateUrl", "listingUrl")
K_SIZE = ("surface", "size", "m2", "sqm", "area", "meters", "squareMeters", "builtArea", "constructedArea", "floorSize")
K_ROOMS = ("rooms", "bedrooms", "habitaciones", "numRooms", "roomNumber", "numberOfRooms", "bedroomCount", "dormitorios")
K_BATHS = ("bathrooms", "banos", "baños", "numBathrooms", "bathroomNumber", "bathroomCount")
K_TITLE = ("title", "titulo", "name", "headline", "subtitle")
K_IMG = ("image", "thumbnail", "photo", "mainImage", "imageUrl", "picture", "cover", "multimedia", "images", "photos")
K_ID = ("id", "adId", "propertyCode", "listingId", "realEstateId", "code")
K_DESC = ("description", "descripcion", "body", "text")
K_DATE = ("publicationDate", "date", "publishedAt", "created_at", "createdAt", "datePosted", "updateDate", "firstPublishedAt", "modifiedDate")
K_ZONE = ("neighborhood", "district", "zone", "barrio", "neighbourhood", "location", "address", "addressLocality")


def _pick(d: dict, keys: Iterable[str]) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, "", [], {}):
            return d[k]
    return None


def _first_image(v: Any) -> str | None:
    if isinstance(v, str):
        return v if v.startswith(("http", "//")) else None
    if isinstance(v, list) and v:
        return _first_image(v[0])
    if isinstance(v, dict):
        for k in ("url", "src", "large", "medium", "imageUrl", "contentUrl", "href"):
            if isinstance(v.get(k), str):
                return v[k]
        for val in v.values():
            img = _first_image(val)
            if img:
                return img
    return None


def _text(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        return v.strip() or None
    if isinstance(v, dict):
        for k in ("name", "text", "value", "label", "streetAddress", "addressLocality"):
            if isinstance(v.get(k), str):
                return v[k]
    return None


def looks_like_listing(d: dict) -> bool:
    has_price = _pick(d, K_PRICE) is not None or isinstance(d.get("offers"), dict)
    has_link = _pick(d, K_URL) is not None or _pick(d, K_ID) is not None
    has_detail = any(_pick(d, ks) is not None for ks in (K_SIZE, K_ROOMS, K_TITLE))
    return has_price and has_link and has_detail


def find_listing_objects(obj: Any, max_depth: int = 12) -> list[dict]:
    """Varre JSON arbitrário e devolve dicts que parecem anúncios. Evita descer dentro de um anúncio já achado."""
    found: list[dict] = []

    def walk(o: Any, depth: int) -> None:
        if depth > max_depth:
            return
        if isinstance(o, dict):
            if looks_like_listing(o):
                found.append(o)
                return
            for v in o.values():
                walk(v, depth + 1)
        elif isinstance(o, list):
            for v in o:
                walk(v, depth + 1)

    walk(obj, 0)
    return found


def generic_from_dict(d: dict, portal: str, base_url: str) -> dict[str, Any] | None:
    """Converte um dict de anúncio (qualquer portal) para o formato de RawListing."""
    offers = d.get("offers") if isinstance(d.get("offers"), dict) else {}
    price = parse_number(_pick(d, K_PRICE) or offers.get("price"))
    url = _pick(d, K_URL) or offers.get("url")
    if isinstance(url, dict):
        url = _pick(url, ("es", "href", "url", "default")) or next((v for v in url.values() if isinstance(v, str)), None)
    ext_id = _pick(d, K_ID)
    if not url and not ext_id:
        return None
    url = urljoin(base_url, str(url)) if url else None
    if not url:
        return None
    floor_size = d.get("floorSize")
    size = parse_size(_pick(d, K_SIZE)) or (parse_number(floor_size.get("value")) if isinstance(floor_size, dict) else None)
    if size is None:
        size = parse_number(_pick(d, K_SIZE))
    desc = _text(_pick(d, K_DESC))
    title = _text(_pick(d, K_TITLE)) or ""
    zone_v = _pick(d, K_ZONE)
    rec: dict[str, Any] = {
        "portal": portal,
        "url": url,
        "external_id": str(ext_id) if ext_id is not None else None,
        "title": title,
        "price": price,
        "size_m2": size,
        "rooms": parse_rooms(_pick(d, K_ROOMS)),
        "bathrooms": parse_int(_pick(d, K_BATHS)),
        "image": _first_image(_pick(d, K_IMG)),
        "description": desc[:600] if desc else None,
        "zone": _text(zone_v),
        "published_at": parse_published(_pick(d, K_DATE)),
    }
    geo = d.get("geo") or d.get("coordinates") or d.get("location") or {}
    if isinstance(geo, dict):
        lat = geo.get("latitude") or geo.get("lat")
        lon = geo.get("longitude") or geo.get("lng") or geo.get("lon")
        if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
            rec["lat"], rec["lon"] = float(lat), float(lon)
    return rec


def soup_of(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


def clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", s or "").strip()
