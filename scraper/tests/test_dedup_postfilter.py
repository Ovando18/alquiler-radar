from app.dedup import group, rank
from app.models import RawListing, SearchFilters
from app.postfilter import apply


def L(**kw):
    base = dict(portal="idealista", url="https://x/1", title="Piso en Calle Reina Victoria, Centro", price=850, rooms=2, size_m2=78)
    base.update(kw)
    return RawListing(**base)


def test_merges_same_flat_across_portals():
    a = L()
    b = L(portal="fotocasa", url="https://f/2", title="Piso Centro calle Reina Victoria", price=860, size_m2=79)
    c = L(portal="pisos", url="https://p/3", title="Ático en Altabix", price=1400, rooms=4, size_m2=140)
    out = group([a, b, c])
    assert len(out) == 2
    merged = next(x for x in out if len(x.sources) == 2)
    assert merged.price == 850
    assert [s.portal for s in merged.sources] == ["idealista", "fotocasa"]
    assert merged.price_m2 == round(850 / 78, 1)


def test_does_not_merge_different_rooms_or_far_coordinates():
    a = L(lat=38.2669, lon=-0.6983)
    b = L(portal="fotocasa", url="https://f/2", lat=38.2800, lon=-0.7100)  # ~1,7 km
    c = L(portal="pisos", url="https://p/3", rooms=3)
    assert len(group([a, b, c])) == 3


def test_coordinates_close_merge():
    a = L(lat=38.26690, lon=-0.69830, title="Piso")
    b = L(portal="fotocasa", url="https://f/2", lat=38.26700, lon=-0.69840, title="Vivienda totalmente distinta")
    assert len(group([a, b])) == 1


def test_stable_id_and_rank_new_first():
    a = L(is_new=False, price=700, url="https://x/a", title="Uno en Carrús")
    b = L(is_new=True, price=900, url="https://x/b", title="Otro en Altabix")
    ranked = rank(group([a, b]))
    assert ranked[0].is_new
    assert group([a])[0].id == group([a])[0].id


def test_postfilter_only_excludes_known_contradictions():
    f = SearchFilters(ciudad="Elche", precio_max=900, habitaciones=["2", "4"], mascotas=True, metros_min=50)
    items = [
        L(url="u1"),                                   # ok
        L(url="u2", price=950),                        # caro
        L(url="u3", rooms=3),                          # quartos errados
        L(url="u4", rooms=5),                          # 4+ ok
        L(url="u5", negatives=["mascotas"]),           # proíbe mascotas
        L(url="u6", price=None, rooms=None, size_m2=None),  # dados ausentes => mantém
        L(url="u7", size_m2=40),                       # pequeno
    ]
    assert [r.url for r in apply(items, f)] == ["u1", "u4", "u6"]


def test_postfilter_zones():
    f = SearchFilters(ciudad="Elche", zonas=["Centro"])
    items = [L(url="a", zone="Centro"), L(url="b", title="Piso en Altabix", zone="Altabix")]
    assert [r.url for r in apply(items, f)] == ["a"]
