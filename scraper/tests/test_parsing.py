from datetime import datetime, timezone

from app.models import SearchFilters
from app.parsing import parse_number, parse_published, parse_rooms, parse_size
from app.scrapers.registry import SCRAPERS


def test_parse_number_variants():
    assert parse_number("1.250 €/mes") == 1250
    assert parse_number("85,5 m²") == 85.5
    assert parse_number("1,250.50") == 1250.5
    assert parse_number({"amount": 900}) == 900
    assert parse_number("sin precio") is None


def test_rooms_and_size():
    assert parse_rooms("Estudio") == 0
    assert parse_rooms("3 hab.") == 3
    assert parse_rooms("2 habitaciones") == 2
    assert parse_size("78 m²") == 78


def test_relative_dates():
    now = datetime(2026, 11, 14, 12, tzinfo=timezone.utc)
    assert parse_published("hace 3 horas", now).startswith("2026-11-14T09")
    assert parse_published("ayer", now).startswith("2026-11-13")
    assert parse_published("2026-11-01T10:00:00Z", now).startswith("2026-11-01T10")


def test_idealista_parser(fixture_html):
    items = SCRAPERS["idealista"].parse(fixture_html("idealista.html"), "https://www.idealista.com/x")
    assert len(items) == 2
    a, b = items
    assert a.url == "https://www.idealista.com/inmueble/104512345/"
    assert (a.price, a.rooms, a.size_m2) == (850, 2, 78)
    assert a.floor.startswith("Planta 3")
    assert a.no_commission is True
    assert {"Amueblado", "Aire acondicionado", "Terraza"} <= set(a.features)
    assert b.rooms == 0 and "mascotas" in b.negatives


def test_fotocasa_embedded_json(fixture_html):
    items = SCRAPERS["fotocasa"].parse(fixture_html("fotocasa.html"), "https://www.fotocasa.es/x")
    assert len(items) == 2
    a = items[0]
    assert a.url.endswith("/180000111/d")
    assert (a.price, a.rooms, a.bathrooms, a.size_m2) == (860, 2, 1, 79)
    assert a.zone == "Centro" and a.lat == 38.2669
    assert a.image.startswith("https://static.fotocasa.es")


def test_generic_json_ld_fallback(fixture_html):
    items = SCRAPERS["spotahome"].parse(fixture_html("jsonld.html"), "https://www.spotahome.com/es/s/valencia")
    assert [i.price for i in items] == [1150, 690]
    assert items[0].rooms == 2 and items[0].size_m2 == 70
    assert items[1].rooms == 0


def test_idealista_url_building():
    f = SearchFilters(provincia="Alicante", ciudad="Elche / Elx", habitaciones=["2"], precio_max=1000,
                      amueblado="amueblado", ascensor=True, publicado="7d", max_paginas=2)
    urls = SCRAPERS["idealista"].build_urls(f)
    assert urls[0] == ("https://www.idealista.com/alquiler-viviendas/elche-elx-alicante/"
                       "con-precio-hasta_1000,de-dos-dormitorios,amueblado_amueblados,ascensor,publicado_ultima-semana/")
    assert urls[1].endswith("/pagina-2.htm")


def test_fotocasa_url_building():
    f = SearchFilters(provincia="Valencia", ciudad="València", habitaciones=["2", "3"], precio_min=600, precio_max=1100)
    url = SCRAPERS["fotocasa"].build_urls(f)[0]
    assert url.startswith("https://www.fotocasa.es/es/alquiler/viviendas/valencia-capital/todas-las-zonas/l?")
    assert "minPrice=600" in url and "maxPrice=1100" in url and "minRooms=2" in url and "maxRooms=3" in url


def test_every_portal_builds_urls():
    f = SearchFilters(provincia="Madrid", ciudad="Madrid", contrato="larga")
    for name, s in SCRAPERS.items():
        if "larga" in s.contratos:
            urls = s.build_urls(f)
            assert urls and urls[0].startswith(s.base_url), name
